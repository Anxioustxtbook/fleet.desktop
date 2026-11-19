/* Pilot's Overview on the phone: the desktop's monthly table (Sheet1), worked out by the desktop's OWN function
   (src/shared/summary.js is the desktop file, unchanged), so the figures are the same wherever the same records are held.
   Read-only. No PIN: the phone has no admin. */
import { monthlySummary, SUMMARY_COLUMNS } from '../shared/summary.js';
import { monthName, fmt } from './tables.js';

const num = v => Number(v) || 0;

/* the months the desktop shows: the first month with any rental, expense or insurance, up to this month (or a later one with data) */
export function monthRange(data, today = new Date()) {
  const all = [], add = s => { if (s && /^\d{4}-\d{2}/.test(s)) all.push(String(s).slice(0, 7)); };
  (data.rentals || []).forEach(r => add(r.pickup)); (data.expenses || []).forEach(x => add(x.date)); (data.insurance || []).forEach(i => add(i.paidDate));
  if (!all.length) return null;
  all.sort(); const now = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  return [all[0], all[all.length - 1] > now ? all[all.length - 1] : now];
}

export function buildOverview(data, today = new Date()) {
  const rg = monthRange(data, today); if (!rg) return { empty: true, message: 'No data yet. Sync with the computer, or add rentals and expenses.' };
  const rows = monthlySummary(data, rg[0], rg[1]);
  const sumCols = r => SUMMARY_COLUMNS.reduce((s, c) => s + num(r[c.key]), 0) + num(r.other);
  const colsOf = r => SUMMARY_COLUMNS.map(c => ({ key: c.key, label: c.label, value: num(r[c.key]) })).concat([{ key: 'other', label: 'Other', value: num(r.other) }]);
  const months = rows.map(r => ({ month: r.month, label: monthName(r.month), billed: num(r.billed), rentals: num(r.rentals), spent: sumCols(r), cols: colsOf(r), net: num(r.billed) - sumCols(r) })).reverse();   // newest month first
  const tot = { billed: 0, spent: 0, rentals: 0 }, byCol = new Map(colsOf({}).map(c => [c.key, { key: c.key, label: c.label, value: 0 }]));
  months.forEach(m => { tot.billed += m.billed; tot.spent += m.spent; tot.rentals += m.rentals; m.cols.forEach(c => { byCol.get(c.key).value += c.value; }); });
  return { empty: false, from: rg[0], to: rg[1], months, totals: { ...tot, net: tot.billed - tot.spent, cols: [...byCol.values()] }, fmt };
}
