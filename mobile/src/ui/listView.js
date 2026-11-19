/* Pure helpers for the list screens: month cards, totals strips and badge colours. */
export const FULL_LIST = ['rentals', 'subhire'];
const REG_STATUS = { Available: 'ok', Rented: 'bl', Maintenance: 'am', Inactive: 'nt', Active: 'ok' };
export const badgeKind = (id, row) => (row.tagTone === 'ok' ? 'ok' : row.tagTone === 'bad' ? 'bad' : row.tagTone === 'amber' ? 'am' : REG_STATUS[row.tag] || (id === 'bookings' ? (row.tag === 'Confirmed' ? 'ok' : row.tag === 'Cancelled' ? 'bad' : 'am') : id === 'fuel' ? (row.tag === 'Ola' ? 'gd' : row.tag === 'Outside' ? 'bl' : 'nt') : 'nt'));

/* the month cards: a header followed by the rows of that month */
export function sectionsOf(items) {
  const out = []; let cur = null;
  items.forEach(it => { if (it.header) { cur = { key: it.key, header: it.header, rows: [] }; out.push(cur); } else { if (!cur) { cur = { key: 'all', header: '', rows: [] }; out.push(cur); } cur.rows.push(it); } });
  return out;
}
/* the totals strips: three to a strip, and a single left-over total is not shown on its own */
export function stripsOf(totals) {
  const a = totals.map(x => [String(x.label).toUpperCase(), x.value]), out = [];
  for (let i = 0; i < a.length; i += 3) out.push(a.slice(i, i + 3));
  return out.filter((st, i) => st.length > 1 || i === 0);
}


/* The Full list of Rentals and Sub-hire: their own columns and a bold total row (UI_SPEC 5.2). Other lists use the generic columns below. */
import { fmt, monthName } from './tables.js';
const sumOf = (rows, k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
export function fullTable(id, rows) {
  if (id === 'rentals') {
    return { head: [['Date'], ['Rental'], ['Details'], ['Billed', 1], ['Paid', 1], ['Owed', 1], ['Status']],
      rows: rows.map(r => [r.date, r.title, r.sub, r.amount, r.paidNum ? fmt(r.paidNum) : '', r.owedNum ? fmt(r.owedNum) : '', r.tag]).concat([['', 'Total', `${rows.length} rentals`, fmt(sumOf(rows, 'amountNum')), fmt(sumOf(rows, 'paidNum')), fmt(sumOf(rows, 'owedNum')), '']]), total: true };
  }
  if (id === 'subhire') {
    return { head: [['Month'], ['Type'], ['Name'], ['Details'], ['Amount', 1], ['Status']],
      rows: rows.map(r => [monthName(r.group), r.facets.lines === 'Owner payments' ? 'Owner' : 'Driver', r.title, r.sub, r.amount, r.tag]).concat([['', '', 'Total', `${rows.length} lines`, fmt(sumOf(rows, 'amountNum')), '']]), total: true };
  }
  return { head: [['Date'], ['Record'], ['Details'], ['Amount', 1], ['Status']], rows: rows.map(r => [r.date || r.group || '', r.title, r.sub, r.amount, r.tag]), total: false };
}
