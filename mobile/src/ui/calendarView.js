/* Calendar rules (no React): the month grid, one colour per car, Free or Booked for a single car, Kenyan holidays.
   Uses the desktop's own calendar and holiday files (src/shared, unchanged apart from the screen code left out). */
import { calendarItems, carMonthSummary, coversDay, vehicleColor, MONTHS } from '../shared/calendarCore.js';
import { kenyaHolidays } from '../shared/holidays.js';

const pad = n => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
export { MONTHS };
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function monthGrid(data, year, month, o = {}) {
  const vehicleId = o.vehicleId || null, today = o.today || '';
  const last = new Date(year, month + 1, 0).getDate(), lead = (new Date(year, month, 1).getDay() + 6) % 7;        // weeks start on Monday
  const items = calendarItems(data, iso(year, month, 1), iso(year, month, last), { vehicleId });
  const hol = new Map(kenyaHolidays(year, o.fixes || {}).map(h => [h.date, h]));
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= last; d++) {
    const day = iso(year, month, d), on = items.filter(it => coversDay(it, day));
    const h = hol.get(day);
    cells.push({ day, d, today: day === today, holiday: h ? h.name : '', tbc: !!(h && h.provisional),
      lines: on.slice(0, 4).map(it => ({ color: vehicleColor(data, it.vehicleId), reg: it.reg, kind: it.kind })), more: Math.max(0, on.length - 4),
      booked: on.length > 0, items: on });
  }
  while (cells.length % 7) cells.push(null);
  const weeks = []; for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const summary = vehicleId ? carMonthSummary(data, vehicleId, year, month) : null;
  return { title: `${MONTHS[month]} ${year}`, weeks, summary, holidays: [...hol.values()].filter(h => h.date.slice(0, 7) === `${year}-${pad(month + 1)}`).map(h => ({ date: h.date, name: h.name, tbc: !!h.provisional })) };
}
export const shiftMonth = (year, month, by) => { const d = new Date(year, month + by, 1); return { year: d.getFullYear(), month: d.getMonth() }; };
export const dayWords = (it) => `${it.reg} · ${it.client} · ${it.kind === 'booking' ? 'Booking' : 'Rental'} ${it.from.slice(5)} to ${it.to.slice(5)}`;
