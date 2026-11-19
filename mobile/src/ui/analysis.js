/* Analysis, now a button inside the Audit. The phone's own view of the records it holds (not the desktop's Excel-file analysis):
   month by month, then the cars and the clients that matter most. The figures use the desktop's own functions
   (summary.js for the months, fuelCore.js for the cars), so they agree with the computer when the same records are held. */
import { monthlySummary, SUMMARY_COLUMNS } from '../shared/summary.js';
import { carPerformance } from '../shared/fuelCore.js';
import { monthRange } from './overview.js';
import { lookups, monthName } from './tables.js';
import { todayISO } from './forms.js';

const num = v => Number(v) || 0;
const r2 = x => Math.round(x * 100) / 100;
export const ANALYSIS_LISTS = ['rentals', 'payments', 'expenses', 'insurance', 'vehicles', 'drivers', 'clients', 'fuelAccount'];

export function buildAnalysis(data, today = todayISO()) {
  const rg = monthRange(data, new Date(today + 'T12:00:00Z'));
  if (!rg) return { empty: true, message: 'No data yet. Sync with the computer, or add rentals and expenses.' };
  const L = lookups(data);
  const rows = monthlySummary(data, rg[0], rg[1], { paidFor: id => L.paid(id) });
  const spentOf = r => SUMMARY_COLUMNS.reduce((s, c) => s + num(r[c.key]), 0) + num(r.other);
  const months = rows.map(r => ({ month: r.month, label: monthName(r.month), rentals: num(r.rentals), days: num(r.days), billed: r2(num(r.billed)), spent: r2(spentOf(r)), net: r2(num(r.billed) - spentOf(r)), collected: r2(num(r.collected)),
    collectedPct: num(r.billed) > 0 ? Math.round(1000 * num(r.collected) / num(r.billed)) / 10 : null })).reverse();       // newest first
  const busy = months.filter(m => m.rentals || m.spent);
  const tot = busy.reduce((t, m) => ({ billed: t.billed + m.billed, spent: t.spent + m.spent, rentals: t.rentals + m.rentals, days: t.days + m.days, collected: t.collected + m.collected }), { billed: 0, spent: 0, rentals: 0, days: 0, collected: 0 });
  const best = busy.length ? busy.reduce((a, b) => (b.net > a.net ? b : a)) : null, worst = busy.length ? busy.reduce((a, b) => (b.net < a.net ? b : a)) : null;
  const maxBar = Math.max(1, ...busy.map(m => Math.max(m.billed, m.spent)));
  const cars = carPerformance(data, rg[0] + '-01', rg[1] + '-31').filter(c => c.rentals > 0).slice(0, 5).map(c => ({ vehicleId: c.vehicleId, reg: c.reg, rentals: c.rentals, days: c.days, billed: c.billed, net: c.net }));
  const by = new Map();
  (data.rentals || []).filter(r => r.status !== 'Cancelled').forEach(r => { const k = String(r.clientId), o = by.get(k) || { clientId: r.clientId, name: L.clientName(r.clientId), rentals: 0, billed: 0, owed: 0 }; o.rentals++; o.billed += num(r.amount); o.owed += Math.max(0, num(r.amount) - L.paid(r.id)); by.set(k, o); });
  const clients = [...by.values()].map(o => ({ ...o, billed: r2(o.billed), owed: r2(o.owed) })).sort((a, b) => b.billed - a.billed).slice(0, 5);
  return { empty: false, from: rg[0], to: rg[1], months, busyMonths: busy.length, totals: { ...tot, billed: r2(tot.billed), spent: r2(tot.spent), net: r2(tot.billed - tot.spent), collected: r2(tot.collected), avgNet: busy.length ? r2((tot.billed - tot.spent) / busy.length) : 0 },
    best, worst, maxBar, cars, clients };
}
