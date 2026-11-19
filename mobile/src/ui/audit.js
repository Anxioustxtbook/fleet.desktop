/* The Audit: what is missing before the records are 100% fluent. No React in here, so it is tested without a phone.
   It answers four plain questions from the records the phone holds:
     - who has not paid us (and how much)             -> "Clients who have not paid"
     - what we have not yet paid (cars, drivers, fuel)  -> "Sub-hire cars / drivers not yet paid", "Fuel account"
     - what is not entered yet (rent)                    -> "Rent not entered"
     - what is incomplete or odd in the records         -> "Records with something missing"
   Every row names the record it is about, so the screen can open it, and the money rows say what to do about them
   ("Record payment", "Mark paid"). Nothing here changes a record. */

import { ownerRows, driverRows, isDriverLine, ownerStatus, driverStatus, STATUS_LABEL } from '../shared/subhireCore.js';
import { fuelPosition, fuelRepeats } from '../shared/fuelAccount.js';
import { fmt, lookups, monthName, payStatus } from './tables.js';
import { monthRange } from './overview.js';
import { todayISO } from './forms.js';

const num = v => Number(v) || 0;
const r2 = x => Math.round(x * 100) / 100;
const same = (a, b) => a != null && b != null && a !== '' && b !== '' && String(a) === String(b);
const key = (list, id) => list + '|' + id;
const has = v => v != null && String(v).trim() !== '';

export const AUDIT_LISTS = ['rentals', 'payments', 'expenses', 'vehicles', 'clients', 'drivers', 'fuelAccount', 'insurance'];

/* months (newest first) that have activity but no Rent entry. The computer fills a month from its own standing rent; the phone does not have that setting, so it asks for the figure instead. */
export function rentMissing(data, today = todayISO()) {
  const rg = monthRange(data, new Date(today + 'T12:00:00Z')); if (!rg) return { months: [], recent: [], earlier: 0, last: 0 };
  const rentEntries = (data.expenses || []).filter(x => x.category === 'Rent' && /^\d{4}-\d{2}/.test(x.date || ''));
  const have = new Set(rentEntries.map(x => x.date.slice(0, 7)));
  const busy = new Set();
  (data.rentals || []).forEach(r => { if (/^\d{4}-\d{2}/.test(r.pickup || '')) busy.add(r.pickup.slice(0, 7)); });
  (data.expenses || []).forEach(x => { if (/^\d{4}-\d{2}/.test(x.date || '')) busy.add(x.date.slice(0, 7)); });
  const now = today.slice(0, 7), months = [];
  for (let ym = rg[0]; ym <= rg[1]; ym = nextMonth(ym)) if (ym <= now && busy.has(ym) && !have.has(ym)) months.push(ym);
  months.reverse();
  const lastEntry = rentEntries.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const recent = months.filter(m => m >= back(now, 2));
  return { months, recent, earlier: months.length - recent.length, last: lastEntry ? num(lastEntry.amount) : 0 };
}
function nextMonth(ym) { let [y, m] = ym.split('-').map(Number); m++; if (m > 12) { m = 1; y++; } return y + '-' + String(m).padStart(2, '0'); }
function back(ym, n) { let [y, m] = ym.split('-').map(Number); m -= n; while (m < 1) { m += 12; y--; } return y + '-' + String(m).padStart(2, '0'); }

/* the Expense form, set to Rent for one month, starting from the last rent entered */
export const rentPreset = (month, last) => ({ category: 'Rent', values: { category: 'Rent', vehicleId: null, date: `${month}-01`, desc: `Rent ${monthName(month)}`, amount: last ? String(last) : '' } });

const groupBy = (items, by, titleOf, subOf) => {
  const map = new Map();
  items.forEach(it => { const k = by(it); let g = map.get(k); if (!g) { g = { key: String(k), title: titleOf(it), sub: '', amount: 0, items: [] }; map.set(k, g); } g.items.push(it); g.amount = r2(g.amount + it.amount); });
  const groups = [...map.values()]; groups.forEach(g => { g.sub = subOf ? subOf(g) : `${g.items.length} ${g.items.length === 1 ? 'line' : 'lines'}`; });
  return groups.sort((a, b) => b.amount - a.amount);
};

export function buildAudit(data, o = {}) {
  const today = o.today || todayISO(), L = lookups(data), reviewOpen = num(o.reviewOpen);
  const rentals = (data.rentals || []).filter(r => r.status !== 'Cancelled');
  const flagged = new Set();
  const owedOf = r => Math.max(0, r2(num(r.amount) - L.paid(r.id)));

  /* ---- money in: clients who have not paid ---- */
  const owing = rentals.filter(r => owedOf(r) > 0).map(r => {
    const st = payStatus(L, r), owed = owedOf(r);
    flagged.add(key('rentals', r.id));
    return { key: 'owe|' + r.id, list: 'rentals', id: r.id, clientId: r.clientId, title: `${L.reg(r.vehicleId)} · ${r.pickup || '—'} to ${r.return || '—'}`, sub: [r.contract ? 'Contract ' + r.contract : '', r.status === 'Active' ? 'Still active' : '', 'Billed ' + fmt(r.amount), L.paid(r.id) ? 'Paid ' + fmt(L.paid(r.id)) : ''].filter(Boolean).join(' · '),
      amount: owed, tag: st, tone: st === 'Unpaid' ? 'bad' : 'amber', action: { kind: 'pay', label: 'Record payment', rentalId: r.id, amount: owed } };
  });
  const owingGroups = groupBy(owing, it => String(it.clientId), it => L.clientName(it.clientId), g => `${g.items.length} ${g.items.length === 1 ? 'rental' : 'rentals'} not settled`);

  /* ---- money out: sub-hire cars and drivers ---- */
  const ownerAll = ownerRows(data), driverAll = driverRows(data);
  const ownersPending = ownerAll.filter(r => r.status === 'notcleared' && r.cost > 0).map(r => { flagged.add(key('rentals', r.id)); return { key: 'own|' + r.id, list: 'rentals', id: r.id, ownerKey: r.ownerKey, owner: r.owner, title: `${r.reg} · ${r.dates}`, sub: [r.job, r.days ? r.days + ' d' : ''].filter(Boolean).join(' · '), amount: r.cost, tag: STATUS_LABEL[r.status], tone: 'amber', action: { kind: 'ownerPaid', label: 'Mark paid', rentalId: r.id } }; });
  const ownerGroups = groupBy(ownersPending, it => it.ownerKey, it => it.owner, g => `${g.items.length} ${g.items.length === 1 ? 'car job' : 'car jobs'} not cleared`);
  const driversPending = driverAll.filter(r => r.status === 'notcleared' && r.amount > 0).map(r => { flagged.add(key('rentals', r.id)); return { key: 'drv|' + r.id, list: 'rentals', id: r.id, driver: r.driver, title: `${r.reg} · ${r.dates}`, sub: [r.client, r.days ? `${r.days} d × ${fmt(r.rate)}` : ''].filter(Boolean).join(' · '), amount: r.amount, tag: STATUS_LABEL[r.status], tone: 'amber', action: { kind: 'driverPaid', label: 'Mark paid', rentalId: r.id } }; });
  const driverGroups = groupBy(driversPending, it => it.driver, it => it.driver, g => `${g.items.length} ${g.items.length === 1 ? 'job' : 'jobs'} not cleared`);

  /* ---- fuel account: negative means the office is behind with the station ---- */
  const pos = fuelPosition(data), fuelOwed = pos.balance < 0 ? r2(-pos.balance) : 0;
  const fuelItems = fuelOwed ? [{ key: 'fuelacc', list: null, id: null, title: 'The fuel account is behind', sub: `Paid in ${fmt(pos.paidIn)}, taken ${fmt(pos.taken)}${pos.opening ? ', opening ' + fmt(pos.opening) : ''}`, amount: fuelOwed, tag: 'Owed to the station', tone: 'bad', action: { kind: 'topup', label: 'Record a top-up', amount: fuelOwed } }] : [];

  /* ---- rent not entered ---- */
  const rent = rentMissing(data, today);
  const rentItems = rent.recent.map(m => ({ key: 'rent|' + m, list: null, id: null, title: monthName(m), sub: rent.last ? `Last rent entered was ${fmt(rent.last)}` : 'No rent has been entered yet', amount: 0, tag: 'Not entered', tone: 'amber', action: { kind: 'addRent', label: 'Add rent', month: m, amount: rent.last } }));

  /* ---- records with something missing ---- */
  const gaps = [];
  const gap = (list, rec, title, sub, what) => { flagged.add(key(list, rec.id)); gaps.push({ key: 'gap|' + list + '|' + rec.id, list, id: rec.id, title, sub, amount: 0, what, tag: what.length === 1 ? what[0] : what.length + ' things', tone: 'amber', action: { kind: 'fix', label: 'Fix it' } }); };
  rentals.forEach(r => {
    const w = [];
    if (!L.vehicle(r.vehicleId)) w.push('car not found');
    if (!L.client(r.clientId)) w.push('no client');
    if (!r.pickup) w.push('no pickup date'); if (!r.return) w.push('no return date');
    if (r.pickup && r.return && r.return < r.pickup) w.push('return before pickup');
    if (!(num(r.amount) > 0)) w.push('no amount');
    if (r.status === 'Active' && r.return && r.return < today) w.push('still Active after its return date');
    if (L.paid(r.id) > num(r.amount) && num(r.amount) > 0) w.push('paid more than billed');
    const car = L.vehicle(r.vehicleId);
    if (car && car.ownership === 'subhire' && !(num(r.subhireCost) > 0) && ownerStatus(r) !== 'cancelled') w.push('sub-hire cost not entered');
    if (isDriverLine(data, r) && !(num(r.driverRate) > 0) && driverStatus(r) !== 'cancelled') w.push('sub-hire driver rate not entered');
    if (w.length) gap('rentals', r, `${L.reg(r.vehicleId)} · ${L.clientName(r.clientId)}`, `${r.pickup || 'no date'} to ${r.return || 'no date'}`, w);
  });
  (data.payments || []).forEach(p => {
    const w = [];
    if (!L.rental(p.rentalId)) w.push('not linked to a rental');
    if (!has(p.date)) w.push('no date'); if (!(num(p.amount) > 0)) w.push('no amount');
    if (w.length) gap('payments', p, `Payment ${fmt(p.amount)}`, [p.date, p.method, p.note].filter(has).join(' · '), w);
  });
  (data.expenses || []).forEach(x => {
    const w = [];
    if (!has(x.date)) w.push('no date'); if (!(num(x.amount) > 0)) w.push('no amount'); if (!has(x.category)) w.push('no category');
    if (x.category === 'Fuel' && x.source !== 'rental' && x.account !== 'Ola' && x.account !== 'Outside') w.push('fuel account not chosen (Ola or Outside)');
    if (has(x.vehicleId) && !L.vehicle(x.vehicleId)) w.push('car not found');
    if (w.length) gap('expenses', x, `${x.category || 'Expense'} ${fmt(x.amount)}`, [x.date, x.vehicleId ? L.reg(x.vehicleId) : 'Office', x.desc].filter(has).join(' · '), w);
  });
  fuelRepeats(data).forEach(g => { g.slice(1).forEach(x => { if (!gaps.some(i => i.key === 'gap|expenses|' + x.id)) gap('expenses', x, `Fuel ${fmt(x.amount)} may be entered twice`, `${x.date} · ${L.reg(x.vehicleId)}`, ['same car, date and amount as another fill']); }); });
  (data.vehicles || []).forEach(v => {
    const w = [];
    if (!has(v.reg)) w.push('no registration'); if (!(num(v.rate) > 0)) w.push('no daily rate');
    if (v.ownership === 'subhire' && !has(v.owner)) w.push('owner not set');
    if (w.length) gap('vehicles', v, v.reg || 'Vehicle without a registration', [v.make, v.model].filter(has).join(' '), w);
  });

  /* ---- the figures ---- */
  const billed = r2(rentals.reduce((s, r) => s + num(r.amount), 0));
  const paidIn = r2(rentals.reduce((s, r) => s + Math.min(L.paid(r.id), Math.max(num(r.amount), 0)), 0));
  const owedTotal = r2(owing.reduce((s, x) => s + x.amount, 0));
  const sum = rows => r2(rows.reduce((s, x) => s + x.amount, 0));
  const money = {
    billed, paid: paidIn, owed: owedTotal, collectedPct: billed > 0 ? Math.round(1000 * paidIn / billed) / 10 : 100,
    settled: rentals.filter(r => owedOf(r) === 0 && num(r.amount) > 0).length, rentals: rentals.length,
    ownersOwed: sum(ownersPending), ownersPaid: r2(ownerAll.filter(r => r.status === 'paid').reduce((s, r) => s + r.cost, 0)),
    driversOwed: sum(driversPending), driversPaid: r2(driverAll.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0)), fuelOwed
  };

  const sections = [
    { id: 'owing', title: 'Clients who have not paid', blurb: 'Rentals with money still to come in. Record the payment on the spot.', amount: owedTotal, count: owing.length, groups: owingGroups, tone: 'bad' },
    { id: 'owners', title: 'Sub-hire cars not yet paid for', blurb: 'What is still owed to the owners of the cars you borrowed.', amount: money.ownersOwed, count: ownersPending.length, groups: ownerGroups, tone: 'amber' },
    { id: 'drivers', title: 'Sub-hire drivers not yet paid', blurb: 'Driver jobs not yet cleared.', amount: money.driversOwed, count: driversPending.length, groups: driverGroups, tone: 'amber' },
    { id: 'fuel', title: 'Fuel account', blurb: 'The running account with the fuel station.', amount: fuelOwed, count: fuelItems.length, groups: fuelItems.length ? [{ key: 'fuel', title: 'Fuel station', sub: '', amount: fuelOwed, items: fuelItems }] : [], tone: 'bad' },
    { id: 'rent', title: 'Rent not entered', blurb: 'The computer fills these from its standing rent. The phone cannot, so add the figure here.', amount: 0, count: rentItems.length, extra: rent.earlier ? `${rent.earlier} earlier ${rent.earlier === 1 ? 'month has' : 'months have'} no Rent entry either. Use Expenses to add them.` : '', groups: rentItems.length ? [{ key: 'rent', title: 'Months', sub: '', amount: 0, items: rentItems }] : [], tone: 'amber' },
    { id: 'gaps', title: 'Records with something missing', blurb: 'Filled in, these records are complete.', amount: 0, count: gaps.length, groups: groupBy(gaps, it => it.list, it => ({ rentals: 'Rentals', payments: 'Payments', expenses: 'Expenses', vehicles: 'Vehicles' })[it.list], g => `${g.items.length} to complete`), tone: 'amber' }
  ];

  const examined = rentals.length + (data.payments || []).length + (data.expenses || []).length + (data.vehicles || []).length;
  const flaggedCount = [...flagged].length;
  const todo = sections.reduce((s, x) => s + x.count, 0) + reviewOpen;
  let fluency = examined ? Math.floor(100 * (examined - flaggedCount) / examined) : 100;
  if (todo > 0 && fluency >= 100) fluency = 99;                                      // 100% only when nothing is left
  return { today, fluency, examined, flagged: flaggedCount, todo, reviewOpen, clear: todo === 0, money, sections, rent };
}

/* the line the Dashboard shows */
export const auditHeadline = a => (a.clear ? 'Everything is settled and complete' : `${a.todo} ${a.todo === 1 ? 'thing' : 'things'} left · ${a.fluency}% complete`);
