/* "Needs attention": the list behind the red card on Home (and the Needs attention page in Step 7). No React.
   lv: r urgent, o coming up, b worth a check. n = how many records. Every rule reads existing records and rules; nothing is saved. */
import { lookups } from './tables.js';
import { ksh0, kshShort } from './money.js';
import { dsh, daysBetween, plural } from './dates.js';
import { ownerRows } from '../shared/subhireCore.js';
import { fuelPosition, fuelRepeats } from '../shared/fuelAccount.js';

const num = v => Number(v) || 0, r2 = x => Math.round(x * 100) / 100;
const more = (first, n) => (n > 1 ? `${first} and ${n - 1} more` : first);

/* rentals not paid up whose return date has passed, worst first */
export function overdueRentals(data, today) {
  const L = lookups(data);
  return (data.rentals || []).filter(r => r.status !== 'Cancelled' && (r.return || r.pickup) && (r.return || r.pickup) < today)
    .map(r => ({ id: r.id, vehicleId: r.vehicleId, reg: L.reg(r.vehicleId), client: L.clientName(r.clientId), due: r.return || r.pickup, contract: r.contract || '', owed: Math.max(0, r2(num(r.amount) - L.paid(r.id))), late: daysBetween(r.return || r.pickup, today) }))
    .filter(x => x.owed > 0).sort((a, b) => b.late - a.late || b.owed - a.owed);
}

export function buildAttention(data, today) {
  const L = lookups(data), items = [];
  const active = (data.rentals || []).filter(r => r.status === 'Active');
  const add = (lv, ic, n, t, s, to) => { if (n > 0) items.push({ lv, ic, n, t, s, to }); };

  const late = active.filter(r => r.return && r.return < today).sort((a, b) => (a.return < b.return ? -1 : 1));
  add('r', 'car', late.length, 'Late return', late.length ? more(`${L.reg(late[0].vehicleId)} · ${L.clientName(late[0].clientId)} · due ${dsh(late[0].return)}`, late.length) : '', 'rentals');

  const od = overdueRentals(data, today), odSum = r2(od.reduce((s, x) => s + x.owed, 0));
  add('r', 'wallet', od.length, 'Unpaid rentals', `${ksh0(odSum)} still owed across ${plural(od.length, 'rental')}`, 'overdue');

  const pos = fuelPosition(data);
  add('r', 'fuel', pos.balance < 0 ? 1 : 0, 'Ola balance is negative', `${kshShort(pos.balance)} owed to the station. Top up.`, 'fuel');

  const due = active.filter(r => r.return === today);
  add('o', 'key', due.length, 'Due back today', due.length ? due.slice(0, 3).map(r => L.reg(r.vehicleId)).join(' · ') + (due.length > 3 ? ` and ${due.length - 3} more` : '') : '', 'rentals');

  const pend = (data.bookings || []).filter(b => b.status === 'Pending' && (b.pickup || '') >= today).sort((a, b) => (a.pickup < b.pickup ? -1 : 1));
  add('o', 'bk', pend.length, 'Bookings still pending', pend.length ? `Next pickup ${daysBetween(today, pend[0].pickup) === 0 ? 'today' : daysBetween(today, pend[0].pickup) === 1 ? 'tomorrow' : dsh(pend[0].pickup)}: ${L.reg(pend[0].vehicleId)}` : '', 'bookings');

  const latest = new Map();
  (data.insurance || []).forEach(i => { if (!i.expiryDate) return; const k = String(i.vehicleId), cur = latest.get(k); if (!cur || i.expiryDate > cur.expiryDate) latest.set(k, i); });
  const ins = [...latest.values()].filter(i => { const v = L.vehicle(i.vehicleId); return v && v.status !== 'Inactive' && daysBetween(today, i.expiryDate) <= 30; }).sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : 1));
  if (ins.length) { const d = daysBetween(today, ins[0].expiryDate); add('o', 'shield', ins.length, 'Insurance due', `${L.reg(ins[0].vehicleId)} ${d < 0 ? `expired ${plural(-d, 'day')} ago` : d === 0 ? 'expires today' : `in ${plural(d, 'day')}`}${ins.length > 1 ? ` · ${ins.length - 1} more within 30 days` : ''}`, 'vehicles'); }

  const owners = ownerRows(data).filter(r => r.status === 'notcleared' && r.cost > 0);
  add('o', 'hand', owners.length, 'Sub-hire owners not paid', `${ksh0(owners.reduce((s, r) => s + r.cost, 0))} to pay out`, 'subhire');

  const untagged = (data.expenses || []).filter(x => x.category === 'Fuel' && x.source !== 'rental' && x.account !== 'Ola' && x.account !== 'Outside');
  add('b', 'fuel', untagged.length, 'Fuel fills with no account', 'Choose Ola or Outside so they count right', 'fuel');

  const rep = fuelRepeats(data);
  if (rep.length) { const x = rep[0][1] || rep[0][0]; add('b', 'shield', rep.length, 'Possible repeat entry', `${L.reg(x.vehicleId)} · ${dsh(x.date)} · ${ksh0(x.amount)} entered twice?`, 'audit'); }

  const total = items.reduce((s, x) => s + x.n, 0);
  const top = items.filter(x => x.lv === 'r').concat(items.filter(x => x.lv === 'o')).slice(0, 3).map(x => `${x.n} ${x.t.toLowerCase()}`).join(' · ');
  return { items, total, top };
}
