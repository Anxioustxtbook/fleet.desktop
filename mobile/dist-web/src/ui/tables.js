/* The table screens' rules, with no React in them (so they are tested without a phone).
   One generic engine: each table says how to turn records into rows, which filter chips it offers, and what its totals are.
   The ORDER of rows is the desktop's own (src/shared/order.js is the desktop file, unchanged); money status words are the desktop's. */
import { newestFirst, newestFirstByMonth } from '../shared/order.js';
import { fillsOf, fillAccount } from '../shared/fuelCore.js';
import { topups } from '../shared/fuelAccount.js';
import { ownerRows, driverRows, STATUS_LABEL } from '../shared/subhireCore.js';
import { keyOf } from '../util.js';

const num = v => Number(v) || 0;
const r2 = x => Math.round(x * 100) / 100;
/* whole shillings (your choice for Step 4); cents are shown only when there are some, so nothing is hidden */
export const fmt = n => { const v = num(n), whole = Math.abs(v - Math.round(v)) < 0.005; return 'KSh ' + (whole ? Math.round(v) : v).toLocaleString('en-GB', whole ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = ym => { const m = /^(\d{4})-(\d{2})/.exec(String(ym || '')); return m ? `${MONTHS[Number(m[2]) - 1] || m[2]} ${m[1]}` : 'No date'; };
const ym = d => (/^\d{4}-\d{2}/.test(String(d || '')) ? String(d).slice(0, 7) : '');
const TYPE_LABEL = { walkin: 'Walk-in', coop: 'Coop', taxi: 'Taxi', self: 'Self-drive' };
export const clientType = t => { const k = String(t == null ? '' : t).trim().toLowerCase().replace(/[\s_-]+/g, ''); const known = { walkin: 'walkin', coop: 'coop', taxi: 'taxi', self: 'self', selfdrive: 'self' }; return k ? (known[k] || String(t).trim().slice(0, 60)) : 'walkin'; };
export const clientTypeLabel = t => { const k = clientType(t); return TYPE_LABEL[k] || k; };

/* ---- lookups ---- */
const index = (list) => { const m = new Map(); (list || []).forEach(r => m.set(String(r.id), r)); return m; };
export function lookups(data) {
  const v = index(data.vehicles), c = index(data.clients), d = index(data.drivers), r = index(data.rentals);
  const paid = new Map(); (data.payments || []).forEach(p => paid.set(String(p.rentalId), (paid.get(String(p.rentalId)) || 0) + num(p.amount)));
  return {
    vehicle: id => v.get(String(id)), client: id => c.get(String(id)), driver: id => d.get(String(id)), rental: id => r.get(String(id)),
    reg: id => (v.get(String(id)) || {}).reg || '—', clientName: id => (c.get(String(id)) || {}).name || '—',
    paid: id => paid.get(String(id)) || 0
  };
}
/* the desktop's own words for how paid a rental is */
export function payStatus(L, r) {
  if (!r) return 'Unpaid';
  if (r.status === 'Cancelled') return 'Cancelled';
  const paid = L.paid(r.id), owed = Math.max(0, num(r.amount) - paid);
  return paid <= 0 ? 'Unpaid' : owed <= 0 ? 'Paid' : 'Partially Paid';
}
const owedOf = (L, r) => (r.status === 'Cancelled' ? 0 : Math.max(0, num(r.amount) - L.paid(r.id)));

/* ---- the tables ---- */
export const TABLE_IDS = ['vehicles', 'drivers', 'clients', 'bookings', 'rentals', 'payments', 'expenses', 'fuel', 'coop', 'subhire'];
const NEEDS = {
  vehicles: ['vehicles'], drivers: ['drivers', 'vehicles'], clients: ['clients'], bookings: ['bookings', 'vehicles', 'clients'],
  rentals: ['rentals', 'vehicles', 'clients', 'payments', 'expenses'], payments: ['payments', 'rentals', 'vehicles', 'clients'],
  expenses: ['expenses', 'vehicles'], fuel: ['expenses', 'fuelAccount', 'vehicles', 'rentals', 'clients'],
  coop: ['coops', 'rentals', 'clients'], subhire: ['rentals', 'vehicles', 'clients', 'drivers', 'expenses']
};
export const tableLists = id => NEEDS[id] || [];
export const isTable = id => TABLE_IDS.includes(id);

/* a row: key, list/id to open, title, sub, amount text + number, tag, month group, and the facet values it can be filtered by */
const row = o => Object.assign({ sub: '', amount: '', amountNum: 0, tag: '', tagTone: '', group: '', date: '', facets: {}, extra: '' }, o);
const sumRows = rows => r2(rows.reduce((s, x) => s + x.amountNum, 0));
const labels = (...xs) => xs.filter(x => x !== '' && x != null).join(' · ');

const DEFS = {
  vehicles: {
    title: 'Vehicles', empty: 'No vehicles yet.', openList: 'vehicles', grouped: false,
    rows: d => newestFirst(d.vehicles).map(v => row({ key: 'vehicles|' + v.id, list: 'vehicles', id: v.id, title: v.reg || '—',
      sub: labels([v.make, v.model, v.year ? "'" + String(v.year).slice(-2) : ''].filter(Boolean).join(' '), v.owner || '', ({ elapsed: 'By time', hours: 'By the hour' })[v.billMode] || 'By day(s)'),
      amount: fmt(v.rate), amountNum: num(v.rate), tag: v.status || '', exited: v.status === 'Inactive', extra: v.ownership === 'subhire' ? 'Sub-hire' : '',
      facets: { status: v.status || '', ownership: v.ownership === 'subhire' ? 'Sub-hire' : 'Own' } })),
    facets: [{ id: 'status', label: 'Status' }, { id: 'ownership', label: 'Owned by' }],
    totals: rows => [{ label: 'Vehicles', value: String(rows.length) }]
  },
  drivers: {
    title: 'Drivers', empty: 'No drivers yet.', openList: 'drivers', grouped: false,
    rows: (d, L) => newestFirst(d.drivers).map(x => row({ key: 'drivers|' + x.id, list: 'drivers', id: x.id, title: x.name || '—',
      sub: labels(x.phone || '', x.license || '', x.vehicleId != null && x.vehicleId !== '' ? L.reg(x.vehicleId) : ''), amount: x.allowance ? fmt(x.allowance) : '', amountNum: num(x.allowance),
      tag: x.status || '', exited: x.status === 'Inactive', facets: { status: x.status || '', kind: x.kind === 'subhire' ? 'Sub-hire' : 'Own' } })),
    facets: [{ id: 'status', label: 'Status' }, { id: 'kind', label: 'Kind' }],
    totals: rows => [{ label: 'Drivers', value: String(rows.length) }]
  },
  clients: {
    title: 'Clients', empty: 'No clients yet.', openList: 'clients', grouped: false,
    rows: d => newestFirst(d.clients).map(c => row({ key: 'clients|' + c.id, list: 'clients', id: c.id, title: c.name || '—',
      sub: labels(c.phone || '', c.area || '', c.idnum || ''), tag: clientTypeLabel(c.type || 'walkin'), exited: c.status === 'Exited', facets: { type: clientTypeLabel(c.type || 'walkin') } })),
    facets: [{ id: 'type', label: 'Type' }],
    totals: rows => [{ label: 'Clients', value: String(rows.length) }]
  },
  bookings: {
    title: 'Bookings', empty: 'No bookings yet.', openList: 'bookings', grouped: true,
    rows: (d, L) => newestFirstByMonth(d.bookings, b => ym(b.pickup)).map(b => row({ key: 'bookings|' + b.id, list: 'bookings', id: b.id, title: labels(L.reg(b.vehicleId), L.clientName(b.clientId)),
      sub: `${b.pickup || '—'} to ${b.return || '—'}`, amount: b.deposit ? fmt(b.deposit) : '', amountNum: num(b.deposit), tag: b.status || '', date: b.pickup || '', group: ym(b.pickup), facets: { status: b.status || '' } })),
    facets: [{ id: 'status', label: 'Status' }],
    totals: rows => [{ label: 'Bookings', value: String(rows.length) }, { label: 'Deposits', value: fmt(sumRows(rows)) }]
  },
  rentals: {
    title: 'Rentals', empty: 'No rentals recorded yet.', openList: 'rentals', grouped: true,
    rows: (d, L) => newestFirstByMonth(d.rentals, r => ym(r.pickup)).map(r => { const paid = L.paid(r.id), owed = owedOf(L, r), st = payStatus(L, r);
      return row({ key: 'rentals|' + r.id, list: 'rentals', id: r.id, title: labels(L.reg(r.vehicleId), L.clientName(r.clientId)),
        sub: labels(`${r.pickup || '—'}${r.pickupTime ? ' ' + r.pickupTime : ''} to ${r.return || '—'}${r.returnTime ? ' ' + r.returnTime : ''}`, r.days != null && r.days !== '' ? r.days + (Number(r.days) === 1 ? ' day' : ' days') : '', r.contract ? 'Contract ' + r.contract : ''),
        amount: fmt(r.amount), amountNum: r.status === 'Cancelled' ? 0 : num(r.amount), tag: st, tagTone: st === 'Paid' ? 'ok' : st === 'Unpaid' || st === 'Cancelled' ? 'bad' : 'amber',
        extra: r.status === 'Cancelled' ? '' : labels(paid ? 'Paid ' + fmt(paid) : '', owed ? 'Owed ' + fmt(owed) : ''), date: r.pickup || '', group: ym(r.pickup),
        facets: { status: r.status || '', payment: st, type: clientTypeLabel(r.type || 'walkin') }, paidNum: r.status === 'Cancelled' ? 0 : paid, owedNum: owed }); }),
    facets: [{ id: 'status', label: 'Status' }, { id: 'payment', label: 'Payment' }, { id: 'type', label: 'Type' }],
    totals: rows => [{ label: 'Billed', value: fmt(sumRows(rows)) }, { label: 'Paid', value: fmt(r2(rows.reduce((s, x) => s + (x.paidNum || 0), 0))) }, { label: 'Owed', value: fmt(r2(rows.reduce((s, x) => s + (x.owedNum || 0), 0))) }, { label: 'Rentals', value: String(rows.length) }]
  },
  payments: {
    title: 'Payments', empty: 'No payments logged yet.', openList: 'payments', grouped: true,
    rows: (d, L) => newestFirstByMonth(d.payments, p => ym(p.date)).map(p => { const r = L.rental(p.rentalId);
      return row({ key: 'payments|' + p.id, list: 'payments', id: p.id, title: r ? labels(L.reg(r.vehicleId), L.clientName(r.clientId)) : 'Not linked to a rental',
        sub: labels(p.date || '—', p.method || '', p.note || ''), amount: '+' + fmt(p.amount), amountNum: num(p.amount), tag: r ? payStatus(L, r) : '', tagTone: r && payStatus(L, r) === 'Paid' ? 'ok' : '',
        date: p.date || '', group: ym(p.date), facets: { method: p.method || 'Other' } }); }),
    facets: [{ id: 'method', label: 'Method' }],
    totals: rows => [{ label: 'Received', value: fmt(sumRows(rows)) }, { label: 'Payments', value: String(rows.length) }]
  },
  expenses: {
    title: 'Expenses', empty: 'No expenses logged yet.', openList: 'expenses', grouped: true,
    rows: (d, L) => newestFirstByMonth(d.expenses, x => ym(x.date)).map(x => row({ key: 'expenses|' + x.id, list: 'expenses', id: x.id, title: labels(x.category || '—', x.vehicleId ? L.reg(x.vehicleId) : 'Office'),
      sub: labels(x.date || '—', x.desc || '', num(x.qty) > 1 ? 'x' + x.qty : ''), amount: fmt(x.amount), amountNum: num(x.amount), tag: x.source === 'rental' ? 'via rental' : '', date: x.date || '', group: ym(x.date),
      facets: { category: x.category || 'Other', scope: x.vehicleId ? 'Vehicles' : 'Office' } })),
    facets: [{ id: 'category', label: 'Category' }, { id: 'scope', label: 'For' }],
    totals: rows => [{ label: 'Total', value: fmt(sumRows(rows)) }, { label: 'Entries', value: String(rows.length) }]
  },
  fuel: {
    title: 'Fuel', empty: 'No fuel entries yet.', openList: null, grouped: true,
    rows: (d, L) => {
      const fills = newestFirstByMonth(fillsOf(d), x => ym(x.date)).map(x => { const r = L.rental(x.rentalId), acc = fillAccount(x) || 'Untagged';
        return row({ key: 'expenses|' + x.id, list: 'expenses', id: x.id, title: labels(x.vehicleId ? L.reg(x.vehicleId) : 'Office', x.date || ''),
          sub: labels(acc, r ? L.clientName(r.clientId) : '', x.desc || ''), amount: fmt(x.amount), amountNum: num(x.amount), tag: acc, date: x.date || '', group: ym(x.date), facets: { account: acc, show: 'Fills' } }); });
      const tops = newestFirstByMonth(topups(d), x => ym(x.date)).map(x => row({ key: 'fuelAccount|' + x.id, list: 'fuelAccount', id: x.id, title: 'Top-up to the fuel account',
        sub: labels(x.date || '', x.note || x.desc || ''), amount: fmt(x.amount), amountNum: num(x.amount), tag: 'Top-up', date: x.date || '', group: ym(x.date), facets: { account: 'Top-up', show: 'Top-ups' } }));
      return fills.concat(tops).sort((a, b) => (a.group < b.group ? 1 : a.group > b.group ? -1 : 0));        // newest month first; inside a month the desktop's own order is kept
    },
    facets: [{ id: 'show', label: 'Show' }, { id: 'account', label: 'Account' }],
    totals: rows => { const f = rows.filter(x => x.facets.show === 'Fills'), t = rows.filter(x => x.facets.show === 'Top-ups'), by = a => sumRows(f.filter(x => x.facets.account === a));
      return [{ label: 'Fills', value: fmt(sumRows(f)) }, { label: 'Ola', value: fmt(by('Ola')) }, { label: 'Outside', value: fmt(by('Outside')) }, { label: 'Untagged', value: fmt(by('Untagged')) }, { label: 'Top-ups', value: fmt(sumRows(t)) }]; }
  },
  coop: {
    title: 'Coop', empty: 'No coop lines yet.', openList: 'coops', grouped: true,
    rows: d => newestFirstByMonth(d.coops, c => ym(c.start)).map(c => row({ key: 'coops|' + c.id, list: 'coops', id: c.id, title: c.name || '—',
      sub: labels(`${c.start || '—'} to ${c.end || '—'}`, c.days ? c.days + ' d' : '', c.contract ? 'Contract ' + c.contract : '', c.department || ''), amount: fmt(c.amount), amountNum: num(c.amount),
      date: c.start || '', group: ym(c.start), facets: { department: c.department || 'None' } })),
    facets: [{ id: 'department', label: 'Department' }],
    totals: rows => [{ label: 'Coop total', value: fmt(sumRows(rows)) }, { label: 'Lines', value: String(rows.length) }]
  },
  subhire: {
    title: 'Sub-hire', empty: 'No sub-hire lines yet.', openList: 'rentals', grouped: true,
    rows: d => {
      const own = ownerRows(d).map(r => row({ key: 'owner|' + r.id, list: 'rentals', id: r.id, title: r.owner, sub: labels(r.reg, r.dates, r.job), amount: fmt(r.cost), amountNum: r.status === 'cancelled' ? 0 : r.cost,
        tag: STATUS_LABEL[r.status] || r.status, tagTone: r.status === 'paid' ? 'ok' : r.status === 'cancelled' ? 'bad' : 'amber', date: r.pickup, group: r.month, facets: { lines: 'Owner payments', status: STATUS_LABEL[r.status] || r.status }, st: r.status }));
      const drv = driverRows(d).map(r => row({ key: 'driver|' + r.id, list: 'rentals', id: r.id, title: r.driver, sub: labels(r.client, r.reg, r.dates), amount: fmt(r.amount), amountNum: r.status === 'cancelled' ? 0 : r.amount,
        tag: STATUS_LABEL[r.status] || r.status, tagTone: r.status === 'paid' ? 'ok' : r.status === 'cancelled' ? 'bad' : 'amber', date: r.pickup, group: r.month, facets: { lines: 'Driver payments', status: STATUS_LABEL[r.status] || r.status }, st: r.status }));
      return own.concat(drv).sort((a, b) => (a.group < b.group ? 1 : a.group > b.group ? -1 : a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    },
    facets: [{ id: 'lines', label: 'Show' }, { id: 'status', label: 'Status' }],
    totals: rows => { const sum = st => sumRows(rows.filter(x => x.st === st)); return [{ label: 'Not cleared', value: fmt(sum('notcleared')) }, { label: 'Paid', value: fmt(sum('paid')) }, { label: 'Lines', value: String(rows.length) }]; }
  }
};
export const tableTitle = id => (DEFS[id] ? DEFS[id].title : id);

export const SORTS = [{ id: 'newest', label: 'Newest first' }, { id: 'oldest', label: 'Oldest first' }, { id: 'amount', label: 'Biggest amount' }, { id: 'name', label: 'A to Z' }];
const haystack = r => [r.title, r.sub, r.tag, r.extra, r.amount, r.date].join(' ').toLowerCase();

/* the whole screen's content in one call */
/* every typed word must appear, and spaces/dashes are ignored, so "kbr670" finds "KBR 670E" */
const squash = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '');
export const searchHit = (hay, q) => { const h = String(hay).toLowerCase(), hs = squash(hay); return String(q).toLowerCase().split(/\s+/).filter(Boolean).every(w => h.includes(w) || hs.includes(squash(w))); };
export function buildTable(id, data, o = {}) {
  const def = DEFS[id]; if (!def) return null;
  const L = lookups(data), every = def.rows(data, L), regs = ['vehicles', 'drivers', 'clients'].includes(id);
  const exitedCount = regs ? every.filter(r => r.exited).length : 0;
  const all = regs ? every.filter(r => !!r.exited === !!o.showExited) : every, q = String(o.search || '').trim().toLowerCase(), filters = o.filters || {}, sort = o.sort || 'newest';
  const passes = (r, skip) => (!q || searchHit(haystack(r), q)) && def.facets.every(f => f.id === skip || !filters[f.id] || r.facets[f.id] === filters[f.id]);
  const rows = all.filter(r => passes(r));
  if (sort === 'oldest') rows.reverse();
  else if (sort === 'amount') rows.sort((a, b) => b.amountNum - a.amountNum);
  else if (sort === 'name') rows.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  const arrivals = o.arrivals || new Set();
  rows.forEach(r => { r.isNew = arrivals.has(keyOf(r.list, r.id)); });
  const grouped = def.grouped && (sort === 'newest' || sort === 'oldest');
  const facetGroups = def.facets.map(f => {
    const counts = new Map(); all.filter(r => passes(r, f.id)).forEach(r => { const v = r.facets[f.id]; if (v !== '' && v != null) counts.set(v, (counts.get(v) || 0) + 1); });
    return { id: f.id, label: f.label, options: [...counts].sort((a, b) => String(a[0]).localeCompare(String(b[0]))).map(([value, count]) => ({ value, label: value, count })) };
  }).filter(g => g.options.length > 1 || filters[g.id]);                       // a filter with only one choice is not shown
  const items = [];
  let last = null;
  rows.forEach(r => { if (grouped && r.group !== last) { items.push({ header: monthName(r.group), key: 'h' + r.group }); last = r.group; } items.push(r); });
  return { id, title: def.title, items, rows, exitedCount, total: all.length, shown: rows.length, facetGroups, totals: def.totals(rows), empty: all.length ? 'No records match.' : (regs ? (o.showExited ? 'Nobody has been exited.' : def.empty.replace('.', ' yet. Tap + to add the first one.').replace('yet yet', 'yet')) : def.empty), openList: def.openList };
}

/* ---- one record, in words ---- */
const LINKS = { vehicleId: ['Vehicle', (L, v) => L.reg(v)], clientId: ['Client', (L, v) => L.clientName(v)], driverId: ['Driver', (L, v) => (L.driver(v) || {}).name || '—'],
  rentalId: ['Rental', (L, v) => { const r = L.rental(v); return r ? labels(L.reg(r.vehicleId), L.clientName(r.clientId), r.pickup) : '—'; }] };
const MONEY = new Set(['amount', 'rate', 'deposit', 'fuel', 'fuelCharge', 'allowance', 'subhireCost', 'driverRate', 'driverPay', 'hourRate', 'ownerCost']);
const prettyKey = k => String(k).replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
export function describeRecord(record, data) {
  const L = lookups(data), out = [];
  Object.keys(record).filter(k => k !== 'id').forEach(k => {
    const v = record[k]; if (v === null || v === undefined || v === '') return;
    if (LINKS[k]) { out.push({ key: k, label: LINKS[k][0], value: LINKS[k][1](L, v) }); return; }
    if (typeof v === 'object') { out.push({ key: k, label: prettyKey(k), value: Array.isArray(v) ? v.length + ' items' : 'details' }); return; }
    out.push({ key: k, label: prettyKey(k), value: MONEY.has(k) ? fmt(v) : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v) });
  });
  return out;
}
