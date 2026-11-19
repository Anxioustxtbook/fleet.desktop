/* Booking calendar: a month grid with a thin line per car (its own colour) for every booking and rental,
   a car drop-down (one car or all), Free / Booked per day, and Kenyan public holidays for any year.
   The pure helpers at the top are used by the tests; initCalendar() draws into #panel-calendar. */
import { kenyaHolidays, holidayMap, DAY_NAMES } from './holidays.js';

const _esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const iso = (y, m, d) => y + '-' + pad(m + 1) + '-' + pad(d);
const todayIso = () => { const d = new Date(); return iso(d.getFullYear(), d.getMonth(), d.getDate()); };

/* A stable colour per registration: the same car always gets the same line colour. */
export function vehicleColor(db, vehicleId){
  const ids = [...(db.vehicles || [])].map(v => v.id).sort((a, b) => a - b);
  const i = Math.max(0, ids.findIndex(id => id == vehicleId));
  return 'hsl(' + Math.round((i * 137.508) % 360) + ' 74% 58%)';
}

/* Every booking / rental that touches [from, to] (ISO dates), optionally for one car. */
export function calendarItems(db, from, to, opts = {}){
  const vid = opts.vehicleId || null, out = [];
  const reg = id => { const v = (db.vehicles || []).find(v => v.id == id); return v ? v.reg : '—'; };
  const cli = id => { const c = (db.clients || []).find(c => c.id == id); return c ? c.name : '—'; };
  const take = (kind, r, a, b) => { if(!a || !b || r.status === 'Cancelled' || (vid && r.vehicleId != vid)) return; const end = b < a ? a : b; if(end < from || a > to) return;
    out.push({ kind, id: r.id, vehicleId: r.vehicleId, reg: reg(r.vehicleId), client: cli(r.clientId), from: a, to: end, status: r.status }); };
  if(opts.bookings !== false) (db.bookings || []).forEach(b => take('booking', b, b.pickup, b.return));
  if(opts.rentals !== false) (db.rentals || []).forEach(r => take('rental', r, r.pickup, r.return));
  return out;
}
export const coversDay = (it, day) => it.from <= day && day <= it.to;

/* For one car over a month: how many days are booked and how many are free. */
export function carMonthSummary(db, vehicleId, year, month, opts = {}){
  const last = new Date(year, month + 1, 0).getDate();
  const items = calendarItems(db, iso(year, month, 1), iso(year, month, last), Object.assign({}, opts, { vehicleId }));
  let booked = 0; const freeDays = [];
  for(let d = 1; d <= last; d++){ const day = iso(year, month, d); if(items.some(it => coversDay(it, day))) booked++; else freeDays.push(day); }
  return { booked, free: last - booked, freeDays, items: items.length };
}


