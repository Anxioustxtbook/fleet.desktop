/* The Overdue payments page rules: late bands, search, totals, and the payment form values. Pure, so it can be tested. */
import { overdueRentals } from './attention.js';
import { searchHit } from './tables.js';
import { ksh0 } from './money.js';

export const BANDS = [{ id: 'all', label: 'All' }, { id: '1-7', label: '1 to 7 days' }, { id: '8-14', label: '8 to 14 days' }, { id: '15+', label: 'Over 14 days' }];
export const inBand = (band, late) => band === 'all' || (band === '1-7' ? late >= 1 && late <= 7 : band === '8-14' ? late >= 8 && late <= 14 : late > 14);

export function buildOverdue(data, today, { search = '', band = 'all' } = {}) {
  const all = overdueRentals(data, today);
  const bands = BANDS.map(b => ({ ...b, count: all.filter(x => inBand(b.id, x.late)).length }));
  const rows = all.filter(x => inBand(band, x.late) && (!search.trim() || searchHit(`${x.reg} ${x.client} ${x.contract}`, search)));
  const sum = rows.reduce((s, x) => s + x.owed, 0);
  return { rows, bands, total: all.length, owed: sum, oldest: rows.length ? Math.max(...rows.map(x => x.late)) : 0 };
}
/* the live line under the amount box */
export function amountMessage(raw, owed) {
  const a = Number(String(raw).replace(/[, ]/g, ''));
  if (!String(raw).trim() || Number.isNaN(a)) return { text: '', tone: 'dim' };
  if (a <= 0) return { text: 'Enter an amount above 0.', tone: 'red' };
  if (a > owed) return { text: `That is more than the ${ksh0(owed)} still owed. Enter up to ${ksh0(owed)}.`, tone: 'red' };
  if (a === owed) return { text: 'This clears the rental in full.', tone: 'green' };
  return { text: `Part payment. ${ksh0(owed - a)} will still be owed.`, tone: 'orange' };
}
export const quickAmount = (kind, owed) => String(kind === 'half' ? Math.round(owed / 2) : Math.round(owed));
/* the same rental, amount and date already recorded: ask before saving a second one */
export const isDuplicate = (payments, rentalId, amount, date) => (payments || []).some(p => String(p.rentalId) === String(rentalId) && Number(p.amount) === Number(amount) && p.date === date);
