/* Money as the new Home shows it (UI_SPEC D2, the prototype's way): whole shillings in rows, short forms on cards.
   The older screens keep tables.fmt (two decimals) until you decide. */
const num = v => Number(v) || 0;
export const ksh0 = n => `${num(n) < 0 ? '-' : ''}KSh ${Math.round(Math.abs(num(n))).toLocaleString('en-US')}`;
export function kshShort(n) {
  const x = num(n), a = Math.abs(x), sign = x < 0 ? '-' : '';
  let v;
  if (a >= 1e6) v = (a / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  else if (a >= 1e5) v = Math.round(a / 1e3) + 'K';
  else if (a >= 1e3) v = (a / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  else v = String(Math.round(a));
  return `${sign}KSh ${v}`;
}
