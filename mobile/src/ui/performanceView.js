/* Performance rules (no React): every rental with its net, filters, totals, and a By car view.
   Net = amount - fuel - allowance - sub-hire - sub-hire driver pay, the desktop's own definition (fuelCore.js is the desktop file). */
import { rentalFuel, rentalDriver, fuelIndex } from '../shared/fuelCore.js';
import { clientTypeLabel, clientType, fmt, lookups } from './tables.js';

const n = v => Number(v) || 0;
const r2 = x => Math.round(x * 100) / 100;
export const PERF_FACETS = [['walkin', 'Walk-in'], ['coop', 'Coop'], ['taxi', 'Taxi'], ['self', 'Self-drive']];

export function rentalNet(data, r, ix) {
  const fuel = rentalFuel(data, r, ix), sub = n(r.subhireStatus === 'cancelled' ? 0 : r.subhireCost), drv = rentalDriver(r);
  return { fuel, sub, drv, allowance: n(r.allowance), net: r2(n(r.amount) - fuel - n(r.allowance) - sub - drv) };
}

export function buildPerformance(data, o = {}) {
  const { from = '', to = '', vehicleId = '', type = '', search = '', view = 'rentals' } = o;
  const L = lookups(data), ix = fuelIndex(data), q = search.trim().toLowerCase();
  const drv = id => (data.drivers || []).find(d => String(d.id) === String(id)) || {};
  const base = (data.rentals || []).filter(r => r.status !== 'Cancelled' && (!from || (r.pickup || '') >= from) && (!to || (r.pickup || '') <= to) && (!vehicleId || String(r.vehicleId) === String(vehicleId))
    && (!q || [L.reg(r.vehicleId), L.clientName(r.clientId), drv(r.driverId).name, r.contract].some(x => String(x || '').toLowerCase().includes(q))));
  const counts = Object.fromEntries(PERF_FACETS.map(([k]) => [k, base.filter(r => clientType(r.type) === k).length]));
  const rows = base.filter(r => !type || clientType(r.type) === type).sort((a, b) => ((b.pickup || '') < (a.pickup || '') ? -1 : 1)).map(r => {
    const m = rentalNet(data, r, ix);
    return { id: r.id, reg: L.reg(r.vehicleId), vehicleId: r.vehicleId, client: L.clientName(r.clientId), type: clientTypeLabel(r.type), pickup: r.pickup || '', ret: r.return || '', days: n(r.days),
      amount: n(r.amount), fuel: m.fuel, allowance: m.allowance, sub: m.sub, driverPay: m.drv, net: m.net, paid: L.paid(r.id), owed: r.status === 'Cancelled' ? 0 : Math.max(0, r2(n(r.amount) - L.paid(r.id))) };
  });
  const sum = k => r2(rows.reduce((s, r) => s + r[k], 0));
  const totals = { rentals: rows.length, amount: sum('amount'), fuel: sum('fuel'), allowance: sum('allowance'), sub: sum('sub'), driverPay: sum('driverPay'), net: sum('net') };
  const byMap = new Map();
  rows.forEach(r => { const k = String(r.vehicleId); const c = byMap.get(k) || { vehicleId: r.vehicleId, reg: r.reg, rentals: 0, days: 0, amount: 0, fuel: 0, net: 0 }; c.rentals++; c.days += r.days; c.amount += r.amount; c.fuel += r.fuel; c.net += r.net; byMap.set(k, c); });
  const byCar = [...byMap.values()].map(c => ({ ...c, amount: r2(c.amount), fuel: r2(c.fuel), net: r2(c.net) })).sort((a, b) => b.net - a.net);
  return { view, rows, totals, byCar, counts, shown: rows.length, total: base.length };
}
export const perfMoney = fmt;
