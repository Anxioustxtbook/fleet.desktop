/* The Coop screen's figures (UI_SPEC 5.2): month and line filters, the VAT view (display only, 16%), totals, and the 16-column table.
   Fuel, driver and allowance are READ from the line's rental (one source), exactly like the desktop's coop.js. */
import { rentalFuel, rentalDriver, fuelIndex } from '../shared/fuelCore.js';
import { monthName } from './tables.js';

export const VAT = 0.16;
const num = v => Number(v) || 0, r2 = x => Math.round(x * 100) / 100;
const ymOf = d => (/^\d{4}-\d{2}/.test(String(d || '')) ? String(d).slice(0, 7) : '');
export const LINES = [{ id: 'all', label: 'All lines' }, { id: 'todo', label: 'To complete' }, { id: 'rentals', label: 'In Rentals' }];

export function coopFigures(db, c, vatOn, ix) {
  const r = c.rentalId ? (db.rentals || []).find(x => String(x.id) === String(c.rentalId)) || null : null;
  const v = r ? (db.vehicles || []).find(x => String(x.id) === String(r.vehicleId)) : null;
  const fuel = r ? rentalFuel(db, r, ix) : num(c.fuel);
  const driver = r ? (num(r.driverRate) ? rentalDriver(r) : num(c.driverPay)) : num(c.driverPay);
  const allowance = r ? num(r.allowance) : num(c.allowance);
  const base = num(c.amount), charge = vatOn ? r2(base * (1 + VAT)) : base;
  return { rental: r, reg: v ? v.reg || '' : '', vehicle: v ? ((v.reg || '') + (v.model ? ' ' + v.model : '')).trim() : '', fuel, driver, allowance, base, charge,
    km: num(c.kmIn) > num(c.kmOut) && num(c.kmOut) > 0 ? num(c.kmIn) - num(c.kmOut) : 0, total: r2(charge + fuel + driver + allowance) };
}

export function coopMonths(db, today) {
  const set = new Set((db.coops || []).map(c => ymOf(c.start)).filter(Boolean)); set.add(today.slice(0, 7));
  return [...set].sort().reverse();
}

export function buildCoop(db, today, { month = 'all', line = 'all', vat = false } = {}) {
  const ix = fuelIndex(db), months = coopMonths(db, today), last = monthKey(today, -1);
  const inMonth = c => month === 'all' || ymOf(c.start) === month;
  const lines = (db.coops || []).filter(c => inMonth(c) && (line === 'all' || (line === 'todo' ? !c.rentalId : !!c.rentalId)))
    .sort((a, b) => (String(a.start) < String(b.start) ? 1 : String(a.start) > String(b.start) ? -1 : 0))
    .map(c => ({ c, g: coopFigures(db, c, vat, ix) }));
  const sum = k => lines.reduce((s, x) => s + num(x.g[k]), 0), base = lines.reduce((s, x) => s + x.g.base, 0), extra = sum('fuel') + sum('driver') + sum('allowance');
  return { months, month, last, thisMonth: today.slice(0, 7), lines, todoCount: (db.coops || []).filter(c => inMonth(c) && !c.rentalId).length,
    totals: { days: lines.reduce((s, x) => s + num(x.c.days), 0), km: sum('km'), charge: sum('charge'), fuel: sum('fuel'), driver: sum('driver'), allowance: sum('allowance'), total: r2(sum('total')) },
    vatInfo: { base: r2(base), vat: r2(base * VAT), incl: r2(base * (1 + VAT)), extra: r2(extra), totalExcl: r2(base + extra), totalIncl: r2(base * (1 + VAT) + extra) } };
}
function monthKey(today, back) { let [y, m] = today.slice(0, 7).split('-').map(Number); m += back; while (m < 1) { m += 12; y--; } return y + '-' + String(m).padStart(2, '0'); }
export const monthLabel = m => (m === 'all' ? 'All months' : monthName(m));

/* the 16 columns of the desktop table, in its order */
export const COOP_HEAD = [['Name of staff served'], ['Branch department'], ['Hire days', 1], ['KMs out', 1], ['KMs in', 1], ['Total KMs', 1], ['Job card / contract'], ['From'], ['To'], ['Vehicle charge', 1], ['Type of vehicle'], ['Fuel', 1], ['Driver', 1], ['Allowance', 1], ['Total', 1], ['In Rentals']];
export const coopRow = ({ c, g }, k) => [c.name || '', c.department || '', c.days || '', c.kmOut || '', c.kmIn || '', g.km || '', c.contract || '', c.start || '', c.end || '', k(g.charge), g.vehicle, k(g.fuel), k(g.driver), k(g.allowance), k(g.total), c.rentalId ? `Yes${g.reg ? ' · ' + g.reg : ''}` : 'To complete'];
