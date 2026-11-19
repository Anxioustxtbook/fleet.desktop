/* small date helpers (ISO yyyy-mm-dd), no time zones */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dsh = d => (/^\d{4}-\d{2}-\d{2}/.test(d || '') ? `${+d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]}` : '');
const ms = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
/* days from a to b (b later = positive) */
export const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / 864e5);
export const addDays = (d, n) => new Date(ms(d) + n * 864e5).toISOString().slice(0, 10);
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
