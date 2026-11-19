/* The Fuel screen's figures (UI_SPEC 5.2): Ola balance, paid in, taken, outside cash, opening / closing, untagged fills, possible repeats,
   and the ledger rows with the running balance. Uses the shared fuel rules; nothing is worked out twice. */
import { fuelPosition, fuelAccountMonths, fuelRepeats, topups, openingBalance } from '../shared/fuelAccount.js';
import { fillsOf, fillAccount } from '../shared/fuelCore.js';
import { lookups, monthName } from './tables.js';

const num = v => Number(v) || 0;
const ymOf = d => (/^\d{4}-\d{2}/.test(String(d || '')) ? String(d).slice(0, 7) : '');
export const SHOWS = [{ id: 'all', label: 'All' }, { id: 'Ola', label: 'Ola' }, { id: 'Outside', label: 'Outside' }, { id: 'Untagged', label: 'Untagged' }, { id: 'topups', label: 'Top-ups' }];

/* every Ola fill and top-up in date order, with the account balance after each (the running balance of the whole account) */
export function runningBalance(db) {
  const e = [];
  topups(db).filter(x => ymOf(x.date)).forEach(x => e.push({ key: 'fuelAccount|' + x.id, type: 'topup', date: x.date, amount: num(x.amount), id: x.id }));
  (db.expenses || []).filter(x => x.category === 'Fuel' && x.account === 'Ola' && ymOf(x.date)).forEach(x => e.push({ key: 'expenses|' + x.id, type: 'fill', date: x.date, amount: num(x.amount), id: x.id }));
  e.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.type === b.type ? String(a.id).localeCompare(String(b.id), undefined, { numeric: true }) : a.type === 'topup' ? -1 : 1));
  let bal = openingBalance(db); const out = new Map();
  e.forEach(x => { bal += x.type === 'topup' ? x.amount : -x.amount; out.set(x.key, bal); });
  return out;
}

export function fuelMonths(db, today) {
  const set = new Set(fuelAccountMonths(db, today.slice(0, 7)).map(m => m.month));
  fillsOf(db).forEach(x => { if (ymOf(x.date)) set.add(ymOf(x.date)); });
  return [...set].sort().reverse();                                      // newest first
}

export function buildFuel(db, today, { month = 'all', show = 'all' } = {}) {
  const L = lookups(db), pos = fuelPosition(db), months = fuelMonths(db, today), bal = runningBalance(db);
  const inMonth = d => month === 'all' || ymOf(d) === month;
  const rows = [];
  fillsOf(db).filter(x => inMonth(x.date)).forEach(x => { const acc = fillAccount(x) || 'Untagged', r = L.rental(x.rentalId);
    rows.push({ key: 'expenses|' + x.id, list: 'expenses', id: x.id, kind: 'fill', date: x.date || '', car: x.vehicleId ? L.reg(x.vehicleId) : 'Office', note: [r ? L.clientName(r.clientId) : '', x.desc || ''].filter(Boolean).join(' · '), account: acc, amount: num(x.amount), balance: acc === 'Ola' && bal.has('expenses|' + x.id) ? bal.get('expenses|' + x.id) : null }); });
  topups(db).filter(x => inMonth(x.date)).forEach(x => rows.push({ key: 'fuelAccount|' + x.id, list: 'fuelAccount', id: x.id, kind: 'topup', date: x.date || '', car: 'Top-up', note: x.note || x.desc || '', account: 'Top-up', amount: num(x.amount), balance: bal.has('fuelAccount|' + x.id) ? bal.get('fuelAccount|' + x.id) : null }));
  const shown = rows.filter(r => show === 'all' || (show === 'topups' ? r.kind === 'topup' : r.kind === 'fill' && r.account === show))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : String(b.id).localeCompare(String(a.id), undefined, { numeric: true })));
  const sum = f => rows.filter(f).reduce((s, r) => s + r.amount, 0);
  const mrow = month === 'all' ? null : fuelAccountMonths(db, today.slice(0, 7)).find(m => m.month === month) || { opening: pos.opening, topups: 0, fills: 0, closing: pos.opening };
  const cards = month === 'all'
    ? { balance: pos.balance, paidIn: pos.paidIn, taken: pos.taken, outside: pos.outside, opening: pos.opening, closing: pos.balance }
    : { balance: mrow.closing, paidIn: mrow.topups, taken: mrow.fills, outside: sum(r => r.kind === 'fill' && r.account === 'Outside'), opening: mrow.opening, closing: mrow.closing };
  const untagged = rows.filter(r => r.kind === 'fill' && r.account === 'Untagged');
  const i = months.indexOf(month);
  return { months, month, label: month === 'all' ? 'All months' : monthName(month), prev: month === 'all' ? null : months[i + 1] || null, next: month === 'all' ? null : months[i - 1] || null,
    cards, untagged: { count: untagged.length, amount: untagged.reduce((s, r) => s + r.amount, 0) }, repeats: fuelRepeats(db).length, rows: shown, count: rows.length };
}

/* the Full list: Date, Type, Car, Rental / note, Account, Amount, Balance */
export const FUEL_HEAD = [['Date'], ['Type'], ['Car'], ['Rental / note'], ['Account'], ['Amount', 1], ['Balance', 1]];
