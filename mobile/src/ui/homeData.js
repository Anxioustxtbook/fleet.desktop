/* Home's figures (UI_SPEC 5.1 and 11). No React. Everything comes from rules the app already has:
   the Pilot overview (billed, spent, fuel), the fuel account, the audit-style owed sums, the performance net per car. */
import { buildOverview } from './overview.js';
import { buildPerformance } from './performanceView.js';
import { buildAttention, overdueRentals } from './attention.js';
import { lookups } from './tables.js';
import { dsh, addDays, daysBetween } from './dates.js';
import { fuelPosition } from '../shared/fuelAccount.js';
import { newestFirst } from '../shared/order.js';
import { monthName } from './tables.js';

export const HOME_LISTS = ['rentals', 'payments', 'vehicles', 'expenses', 'fuelAccount', 'bookings', 'clients', 'drivers', 'insurance'];
const num = v => Number(v) || 0, r2 = x => Math.round(x * 100) / 100;
const modelOf = v => (v ? (v.model || v.make || '') : '');

export const greeting = (d = new Date()) => (d.getHours() < 12 ? 'Good morning' : d.getHours() < 17 ? 'Good afternoon' : 'Good evening');

export function buildHome(data, today) {
  const L = lookups(data), ym = today.slice(0, 7), vehicles = data.vehicles || [];
  const idx = id => Math.max(0, vehicles.findIndex(v => String(v.id) === String(id)));
  const rentals = (data.rentals || []).filter(r => r.status !== 'Cancelled');

  /* hero: this month, the same billed / spent as the Pilot overview */
  const ov = buildOverview(data, new Date(today + 'T12:00:00Z'));
  const m = ov.empty ? null : ov.months.find(x => x.month === ym);
  const billed = m ? m.billed : 0, spent = m ? m.spent : 0;
  const received = r2((data.payments || []).filter(p => (p.date || '').slice(0, 7) === ym).reduce((s, p) => s + num(p.amount), 0));
  const hero = { label: monthName(ym), billed, rentals: m ? m.rentals : 0, received, spent, net: r2(billed - spent) };

  /* cars out now: Active rentals that have started */
  const outR = (data.rentals || []).filter(r => r.status === 'Active' && (r.pickup || '') <= today);
  const outIds = new Set(outR.map(r => String(r.vehicleId)));
  const inFleet = vehicles.filter(v => v.status !== 'Inactive');
  const available = inFleet.filter(v => v.status !== 'Maintenance' && !outIds.has(String(v.id))).length;
  const fleet = { out: outIds.size, total: Math.max(inFleet.length, outIds.size), available, pct: inFleet.length ? Math.round(100 * outIds.size / Math.max(inFleet.length, outIds.size)) : 0 };

  const owedRows = rentals.map(r => Math.max(0, r2(num(r.amount) - L.paid(r.id)))).filter(x => x > 0);
  const stats = { fleet, owed: { total: r2(owedRows.reduce((a, b) => a + b, 0)), rentals: owedRows.length }, fuelMonth: m ? (m.cols.find(c => c.key === 'fuel') || { value: 0 }).value : 0, fuelBalance: r2(fuelPosition(data).balance) };

  const attention = buildAttention(data, today);
  const od = overdueRentals(data, today);
  const overdue = { list: od, total: r2(od.reduce((s, x) => s + x.owed, 0)), count: od.length, oldest: od.length ? od[0].late : 0 };

  const out = outR.map(r => {
    const v = L.vehicle(r.vehicleId), late = !!r.return && r.return < today, same = r.return === today;
    return { id: r.id, reg: L.reg(r.vehicleId), model: modelOf(v), colour: idx(r.vehicleId), client: L.clientName(r.clientId), due: r.return || '',
      badge: late ? { text: 'Late', kind: 'bad' } : same ? { text: 'Today', kind: 'am' } : r.return ? { text: dsh(r.return), kind: 'bl' } : { text: 'No return date', kind: 'nt' },
      owed: Math.max(0, r2(num(r.amount) - L.paid(r.id))), sort: r.return || '9999' };
  }).sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0));

  const end = addDays(today, 7), ev = [];
  (data.bookings || []).filter(b => b.status !== 'Cancelled' && (b.pickup || '') >= today && b.pickup <= end).forEach(b => {
    const v = L.vehicle(b.vehicleId);
    ev.push({ key: 'b' + b.id, d: b.pickup, kind: 'Pickup', list: 'bookings', id: b.id, reg: L.reg(b.vehicleId), model: modelOf(v), colour: idx(b.vehicleId), client: L.clientName(b.clientId), time: b.pickupTime || '', pending: b.status === 'Pending', deposit: num(b.deposit) });
  });
  outR.filter(r => r.return && r.return >= today && r.return <= end).forEach(r => {
    const v = L.vehicle(r.vehicleId);
    ev.push({ key: 'r' + r.id, d: r.return, kind: 'Return', list: 'rentals', id: r.id, reg: L.reg(r.vehicleId), model: modelOf(v), colour: idx(r.vehicleId), client: L.clientName(r.clientId), time: '', pending: false, deposit: 0 });
  });
  ev.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.kind < b.kind ? -1 : 1));
  const next7 = ev.map(e => { const n = daysBetween(today, e.d); return { ...e, when: n === 0 ? `Today · ${dsh(e.d)}` : n === 1 ? `Tomorrow · ${dsh(e.d)}` : dsh(e.d) }; });

  /* latest payments: money in (payments) and money out (expenses, fuel top-ups) together, newest first, each tagged */
  const flow = [];
  (data.payments || []).forEach(p => { const r = L.rental(p.rentalId); flow.push({ key: 'p' + p.id, id: p.id, date: p.date || '', kind: 'in', title: r ? L.clientName(r.clientId) : 'Payment', sub: [r ? `Rental ${L.reg(r.vehicleId)}` : '', dsh(p.date), p.method || ''].filter(Boolean).join(' · '), amount: num(p.amount) }); });
  (data.expenses || []).forEach(x => flow.push({ key: 'x' + x.id, id: x.id, date: x.date || '', kind: 'out', title: [x.category || 'Expense', x.vehicleId ? L.reg(x.vehicleId) : ''].filter(Boolean).join(' · '), sub: [dsh(x.date), x.method || (x.account ? `${x.account} account` : '')].filter(Boolean).join(' · '), amount: -num(x.amount) }));
  (data.fuelAccount || []).filter(f => f.kind !== 'opening').forEach(f => flow.push({ key: 'f' + f.id, id: f.id, date: f.date || '', kind: 'out', title: 'Ola fuel top-up', sub: [dsh(f.date), f.method || ''].filter(Boolean).join(' · '), amount: -num(f.amount) }));
  const payments = flow.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (Number(b.id) || 0) - (Number(a.id) || 0))).slice(0, 5);

  const perf = buildPerformance(data, { from: `${ym}-01`, to: `${ym}-31` });
  const cars = perf.byCar.map(c => ({ vehicleId: c.vehicleId, reg: c.reg, model: modelOf(L.vehicle(c.vehicleId)), colour: idx(c.vehicleId), rentals: c.rentals, days: c.days, billed: c.amount, fuel: c.fuel, other: r2(c.amount - c.fuel - c.net), net: c.net }));
  const sum = k => r2(cars.reduce((s, c) => s + c[k], 0));
  const byCar = { label: monthName(ym), cars, total: { rentals: sum('rentals'), days: sum('days'), billed: sum('billed'), fuel: sum('fuel'), other: sum('other'), net: sum('net') } };

  return { today, hero, stats, attention, overdue, out, next7, payments, byCar };
}
