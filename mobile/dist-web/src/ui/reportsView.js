/* Reports rules (no React): a period (day, week, month, year or your own dates) worked out from the records.
   Billed = rentals picked up in the period; Received = payments dated in it; Spent = expenses dated in it (fuel a rental carried is already one of them);
   Owed = what is still unpaid on those rentals. All figures are for looking: nothing is saved. */
import { fmt, lookups } from './tables.js';
import { rentalNet } from './performanceView.js';
import { fuelIndex } from '../shared/fuelCore.js';

const n = v => Number(v) || 0, r2 = x => Math.round(x * 100) / 100, pad = x => String(x).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
export const PERIODS = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year'], ['custom', 'Custom']];

/* the dates a period covers; anchor is any day inside it (weeks run Monday to Sunday) */
export function periodRange(kind, anchor, custom = {}) {
  const a = parse(anchor);
  if (kind === 'day') return { from: isoOf(a), to: isoOf(a), label: isoOf(a) };
  if (kind === 'week') { const s = new Date(a); s.setDate(a.getDate() - ((a.getDay() + 6) % 7)); const e = new Date(s); e.setDate(s.getDate() + 6); return { from: isoOf(s), to: isoOf(e), label: `${isoOf(s)} to ${isoOf(e)}` }; }
  if (kind === 'month') { const s = new Date(a.getFullYear(), a.getMonth(), 1), e = new Date(a.getFullYear(), a.getMonth() + 1, 0); return { from: isoOf(s), to: isoOf(e), label: s.toLocaleString('en-GB', { month: 'long', year: 'numeric' }) }; }
  if (kind === 'year') return { from: `${a.getFullYear()}-01-01`, to: `${a.getFullYear()}-12-31`, label: String(a.getFullYear()) };
  const f = custom.from || isoOf(a), t = custom.to || f; return t < f ? { from: t, to: f, label: `${t} to ${f}` } : { from: f, to: t, label: `${f} to ${t}` };
}
export function stepPeriod(kind, anchor, by) {
  const a = parse(anchor);
  if (kind === 'day') a.setDate(a.getDate() + by); else if (kind === 'week') a.setDate(a.getDate() + 7 * by); else if (kind === 'month') a.setMonth(a.getMonth() + by); else if (kind === 'year') a.setFullYear(a.getFullYear() + by);
  return isoOf(a);
}
const within = (d, r) => !!d && d >= r.from && d <= r.to;

export function buildReport(data, range, o = {}) {
  const vehicleId = o.vehicleId || '', today = o.today || isoOf(new Date());
  const L = lookups(data), ix = fuelIndex(data), car = id => !vehicleId || String(id) === String(vehicleId);
  const rentals = (data.rentals || []).filter(r => r.status !== 'Cancelled' && within(r.pickup, range) && car(r.vehicleId));
  const expenses = (data.expenses || []).filter(x => within(x.date, range) && car(x.vehicleId));
  const payments = (data.payments || []).filter(p => within(p.date, range) && (!vehicleId || car((L.rental(p.rentalId) || {}).vehicleId)));
  const billed = r2(rentals.reduce((s, r) => s + n(r.amount), 0)), spent = r2(expenses.reduce((s, x) => s + n(x.amount), 0)), received = r2(payments.reduce((s, p) => s + n(p.amount), 0));
  const owed = r2(rentals.reduce((s, r) => s + Math.max(0, n(r.amount) - L.paid(r.id)), 0));
  const cards = [['Billed', fmt(billed)], ['Received', fmt(received)], ['Spent', fmt(spent)], ['Billed less spent', fmt(r2(billed - spent))], ['Still owed', fmt(owed)], ['Rentals', String(rentals.length)]];
  const byMap = new Map();
  const slot = id => { const k = String(id); if (!byMap.has(k)) byMap.set(k, { vehicleId: id, reg: L.reg(id), rentals: 0, billed: 0, spent: 0 }); return byMap.get(k); };
  rentals.forEach(r => { const c = slot(r.vehicleId); c.rentals++; c.billed += n(r.amount); });
  expenses.forEach(x => { if (x.vehicleId !== '' && x.vehicleId != null) slot(x.vehicleId).spent += n(x.amount); });
  const byCar = [...byMap.values()].map(c => ({ ...c, billed: r2(c.billed), spent: r2(c.spent), net: r2(c.billed - c.spent) })).sort((a, b) => b.billed - a.billed);
  const out = (data.rentals || []).filter(r => r.status === 'Active' && car(r.vehicleId) && (r.pickup || '') <= today).map(r => ({ id: r.id, reg: L.reg(r.vehicleId), client: L.clientName(r.clientId), due: r.return || '', overdue: !!r.return && r.return < today })).sort((a, b) => (a.due < b.due ? -1 : 1));
  return { range, cards, byCar, carsOut: out, totals: { billed, spent, received, owed, net: r2(billed - spent) }, rentals: rentals.length };
}

/* one car's statement: its rentals (+) and expenses (-) and payments in date order, with a running figure */
export function carStatement(data, vehicleId, range) {
  const L = lookups(data), items = [];
  (data.rentals || []).filter(r => r.status !== 'Cancelled' && String(r.vehicleId) === String(vehicleId) && within(r.pickup, range)).forEach(r => items.push({ date: r.pickup, text: `Rental · ${L.clientName(r.clientId)}`, charge: n(r.amount), cost: 0 }));
  (data.expenses || []).filter(x => String(x.vehicleId) === String(vehicleId) && within(x.date, range)).forEach(x => items.push({ date: x.date, text: `${x.category || 'Expense'}${x.desc ? ' · ' + x.desc : ''}`, charge: 0, cost: n(x.amount) }));
  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let run = 0; return items.map(i => { run = r2(run + i.charge - i.cost); return { ...i, running: run }; });
}
