/* The entry forms' rules, with no React in them (so they are tested without a phone).
   One form per table. Each says: its fields IN THE ORDER you fill them (Enter moves to the next one), what is checked
   before saving, and the plan of saves it makes. The screen (screens/EntryForm.js) only draws what this file decides.

   Rules copied from the desktop's own forms: a rental's days and amount come from the desktop's billing.js; a payment cannot be more than what
   is still owed; a rental's fronted fuel is also written as a Fuel expense (so the Overview adds up the same); a sub-hire car's cost
   is the car's cost per day times the days unless typed; a new rental on the road makes the car "Rented"; double bookings are warned about. */

import { charge, duration } from '../shared/billing.js';
import { syncOwnerFromTick, setOwnerStatus, setDriverStatus } from '../shared/subhireCore.js';
import { rentalForFill } from '../shared/fuelCore.js';
import { clientType, fmt, lookups } from './tables.js';
import { ksh0 } from './money.js';

const num = v => Number(v) || 0;
export const NEEDED = 'This is needed.';
export const FUTURE_MSG = 'A payment or expense cannot be dated after today.';
export const RETURN_BEFORE = 'The return date is before the pickup date.';
export const DUP_FUEL = 'A fill for this car on this date with this amount is already recorded. Tap Save again only if it is a second fill.';
const r2 = x => Math.round(x * 100) / 100;
const same = (a, b) => a != null && b != null && a !== '' && b !== '' && String(a) === String(b);
const pad = n => String(n).padStart(2, '0');
export const todayISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/* ---------- typing a date or a time: forgiving, then shown back in full so the person can see how it was read ---------- */
const realDate = (y, m, d) => { if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1) return ''; const dt = new Date(Date.UTC(y, m - 1, d)); return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : ''; };
export function parseDate(text, today = todayISO()) {
  const t = String(text == null ? '' : text).trim().toLowerCase();
  if (!t) return '';
  const [ty, tm, td] = today.split('-').map(Number);
  if (t === 't' || t === 'today') return today;
  if (t === 'y' || t === 'yesterday') { const d = new Date(Date.UTC(ty, tm - 1, td - 1)); return realDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
  let m;
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t))) return realDate(+m[1], +m[2], +m[3]);
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(t))) return realDate(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  if ((m = /^(\d{1,2})[-/.](\d{1,2})$/.exec(t))) return realDate(ty, +m[2], +m[1]);
  if (/^\d+$/.test(t)) {
    if (t.length <= 2) return realDate(ty, tm, +t);                                   // "5" = the 5th of this month
    if (t.length === 4) return realDate(ty, +t.slice(2), +t.slice(0, 2));             // "1011" = 10 Nov this year
    if (t.length === 6) return realDate(2000 + +t.slice(4), +t.slice(2, 4), +t.slice(0, 2));
    if (t.length === 8) { const y = +t.slice(0, 4); return y >= 2000 && y <= 2100 ? realDate(y, +t.slice(4, 6), +t.slice(6)) : realDate(+t.slice(4), +t.slice(2, 4), +t.slice(0, 2)); }
  }
  return '';
}
export function parseTime(text) {
  const t = String(text == null ? '' : text).trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return '';
  const m = /^(\d{1,2})(?::?(\d{2}))?(am|pm)?$/.exec(t);
  if (!m) return '';
  let h = +m[1]; const min = m[2] ? +m[2] : 0;
  if (m[3] === 'pm' && h < 12) h += 12; if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return '';
  return `${pad(h)}:${pad(min)}`;
}
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const isFuture = (text, c) => { const d = parseDate(text, c.today); return !!d && d > c.today; };
export const dateWords = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return ''; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return `${DAYS[d.getUTCDay()]} ${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`; };
export const parseMoney = text => { const t = String(text == null ? '' : text).replace(/ksh/gi, '').replace(/[,\s]/g, ''); if (t === '') return NaN; return /^-?\d*\.?\d+$/.test(t) ? Number(t) : NaN; };

/* ---------- matching what is typed against what already exists ---------- */
const squash = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '');
/* "kbr670" matches "KBR 670E"; "john o" matches "John Otieno": every typed word must be found, spaces and dashes ignored */
export const matches = (text, query) => String(query || '').toLowerCase().split(/\s+/).filter(Boolean).every(w => String(text).toLowerCase().includes(w) || squash(text).includes(squash(w)));
const rank = (text, q) => { const a = squash(text), b = squash(q); return a === b ? 0 : a.startsWith(b) ? 1 : 2; };
const digits = s => String(s == null ? '' : s).replace(/\D/g, '');

/* Suggestions while typing. Two kinds:
     'existing'  the thing typed is already in the database: tapping opens that record (so a second copy is not made)
     'use'       a client typed inside a rental: tapping uses the existing client
     'fill'      a name seen before (an owner, a driver): tapping completes the field
   kind is the field's `suggest` setting. Returns up to 5, best match first. */
export function suggestions(kind, text, data, c = {}) {
  const q = String(text == null ? '' : text).trim();
  if (squash(q).length < 2 && digits(q).length < 3) return [];
  const exId = c.existing && c.existing.id, out = [];
  const add = (list, rows, label, sub, extra) => rows.forEach(r => out.push({ key: list + '|' + r.id, rank: rank(label(r), q), label: label(r) || '—', sub: sub(r), ...extra(r) }));
  const isEdit = (list) => r => ({ action: 'edit', list, id: r.id });
  const others = rows => (rows || []).filter(r => !same(r.id, exId));
  if (kind === 'vehicleReg') add('vehicles', others(data.vehicles).filter(v => matches(`${v.reg} ${v.make} ${v.model}`, q)), v => v.reg, v => ['Already in the database', [v.make, v.model].filter(Boolean).join(' '), v.rate ? fmt(v.rate) + ' a day' : ''].filter(Boolean).join(' · '), isEdit('vehicles'));
  if (kind === 'clientName') add('clients', others(data.clients).filter(x => matches(`${x.name} ${x.phone}`, q) || (digits(q).length >= 6 && digits(x.phone).includes(digits(q)))), x => x.name, x => ['Already a client', x.phone, x.area].filter(Boolean).join(' · '), isEdit('clients'));
  if (kind === 'driverName') add('drivers', others(data.drivers).filter(x => matches(`${x.name} ${x.phone}`, q)), x => x.name, x => ['Already a driver', x.phone].filter(Boolean).join(' · '), isEdit('drivers'));
  if (kind === 'rentalClient') add('clients', (data.clients || []).filter(x => matches(`${x.name} ${x.phone}`, q)), x => x.name, x => ['Use this client', x.phone, x.area].filter(Boolean).join(' · '), x => ({ action: 'use', field: 'clientId', value: x.id, clear: ['newClientName'] }));
  if (kind === 'ownerName') { const seen = new Set(); (data.vehicles || []).forEach(v => { const n = String(v.owner || '').trim(); if (n && !seen.has(n.toLowerCase()) && matches(n, q) && squash(n) !== squash(q)) { seen.add(n.toLowerCase()); out.push({ key: 'own|' + n, rank: rank(n, q), label: n, sub: 'Owner already used on a vehicle', action: 'fill', value: n }); } }); }
  if (kind === 'driverNameFill') { const seen = new Set(); [...(data.drivers || []).map(d => [d.name, d.phone]), ...(data.clients || []).map(x => [x.driverName, x.driverPhone])].forEach(([n, p]) => { n = String(n || '').trim(); if (n && !seen.has(n.toLowerCase()) && matches(n, q) && squash(n) !== squash(q)) { seen.add(n.toLowerCase()); out.push({ key: 'drv|' + n, rank: rank(n, q), label: n, sub: p ? 'Driver ' + p : 'Driver already known', action: 'fill', value: n, also: p ? { driverPhone: String(p) } : null }); } }); }
  return out.sort((a, b) => a.rank - b.rank || String(a.label).localeCompare(String(b.label))).slice(0, 5);
}

/* ---------- choices ---------- */
const STATUS_VEHICLE = ['Available', 'Rented', 'Maintenance', 'Inactive'].map(v => ({ value: v, label: v }));
const CLIENT_TYPES = [{ value: 'walkin', label: 'Walk-in' }, { value: 'coop', label: 'Coop' }, { value: 'taxi', label: 'Taxi' }, { value: 'self', label: 'Self-drive' }];
const METHODS = ['Cash', 'M-Pesa', 'Bank transfer', 'Card', 'Deposit', 'Other'].map(v => ({ value: v, label: v }));
export const METHODS_LIST = METHODS.map(m => m.value);
const BASE_CATEGORIES = ['Fuel', 'Car wash', 'Tyres', 'Insurance', 'Parking', 'Rent', 'Garage', 'Cleaning', 'Transport', 'Airport', 'Other'];
const BILL_MODES = [{ value: '', label: "Car's billing" }, { value: 'auto', label: 'By day(s)' }, { value: 'elapsed', label: 'By time' }, { value: 'hours', label: 'By the hour' }, { value: 'days', label: 'I enter days' }, { value: 'fixed', label: 'Agreed total' }];
const yn = (v, label) => ({ value: v, label });

/* ---------- looking things up ---------- */
const byId = (list, id) => (list || []).find(x => same(x.id, id)) || null;
const paidOn = (data, rentalId, exceptPaymentId) => (data.payments || []).filter(p => same(p.rentalId, rentalId) && !same(p.id, exceptPaymentId)).reduce((s, p) => s + num(p.amount), 0);
export const owedOn = (data, rental, exceptPaymentId) => (!rental || rental.status === 'Cancelled' ? 0 : Math.max(0, r2(num(rental.amount) - paidOn(data, rental.id, exceptPaymentId))));

/* double booking: the desktop's own rule (dates overlap, cancelled ones ignored) */
export function vehicleConflicts(data, vehicleId, pickup, ret, opts = {}) {
  const out = [], L = lookups(data), clash = (a, b, c, d) => a <= d && b >= c;
  (data.bookings || []).forEach(b => { if (!same(b.vehicleId, vehicleId) || b.status === 'Cancelled' || same(b.id, opts.excludeBookingId)) return;
    if (clash(pickup, ret, b.pickup, b.return)) out.push(`Booking (${b.status}) for ${L.clientName(b.clientId)}: ${b.pickup} to ${b.return}`); });
  (data.rentals || []).forEach(r => { if (!same(r.vehicleId, vehicleId) || r.status === 'Cancelled' || same(r.id, opts.excludeRentalId)) return;
    if (clash(pickup, ret, r.pickup, r.return)) out.push(`Rental (${r.status}) for ${L.clientName(r.clientId)}: ${r.pickup} to ${r.return}`); });
  return out;
}

/* ---------- what a pick field offers ---------- */
export function pickOptions(pick, data, values = {}, ctx = {}) {
  const L = lookups(data);
  if (pick === 'vehicles') return [...(data.vehicles || [])].sort((a, b) => String(a.reg).localeCompare(String(b.reg))).map(v => ({ id: v.id, label: v.reg || '—', sub: [[v.make, v.model].filter(Boolean).join(' '), v.rate ? fmt(v.rate) + ' a day' : '', v.ownership === 'subhire' ? 'Sub-hire' : ''].filter(Boolean).join(' · ') }));
  if (pick === 'clients') return [...(data.clients || [])].sort((a, b) => String(a.name).localeCompare(String(b.name))).map(c => ({ id: c.id, label: c.name || '—', sub: [c.phone, c.area].filter(Boolean).join(' · ') }));
  if (pick === 'drivers') return [...(data.drivers || [])].sort((a, b) => String(a.name).localeCompare(String(b.name))).map(d => ({ id: d.id, label: d.name || '—', sub: [d.phone, d.kind === 'subhire' ? 'Sub-hire driver' : ''].filter(Boolean).join(' · ') }));
  if (pick === 'coopRentals') return [...(data.rentals || [])].filter(r => r.type === 'coop' && r.status !== 'Cancelled').sort((a, b) => String(b.pickup).localeCompare(String(a.pickup))).map(r => ({ id: r.id, label: `${L.clientName(r.clientId)} · ${L.reg(r.vehicleId)}`, sub: `${r.pickup || '—'}${r.return && r.return !== r.pickup ? ' to ' + r.return : ''}${r.contract ? ' · ' + r.contract : ''}${(data.coops || []).some(c => same(c.rentalId, r.id)) ? ' · has a line' : ''}` }));
  if (pick === 'rentalsOwing' || pick === 'rentalsAll') {
    const keep = ctx.currentRentalId;
    return [...(data.rentals || [])].filter(r => r.status !== 'Cancelled' && (pick === 'rentalsAll' || owedOn(data, r, ctx.exceptPaymentId) > 0 || same(r.id, keep)))
      .sort((a, b) => String(b.pickup).localeCompare(String(a.pickup)))
      .map(r => { const owed = owedOn(data, r, ctx.exceptPaymentId); return { id: r.id, label: `${L.reg(r.vehicleId)} · ${L.clientName(r.clientId)}`, sub: `${r.pickup || '—'} to ${r.return || '—'}${r.contract ? ' · ' + r.contract : ''}${pick === 'rentalsOwing' ? ' · owed ' + fmt(owed) : ''}` }; });
  }
  return [];
}
export const pickLabel = (pick, data, id) => { if (id == null || id === '') return ''; const o = pickOptions(pick, data, {}, { currentRentalId: id }).find(x => same(x.id, id)); return o ? o.label : ''; };

/* ---------- the forms ---------- */
const F = (key, label, type, more = {}) => ({ key, label, type, ...more });

export const FORMS = {
  vehicles: {
    list: 'vehicles', noun: 'vehicle', needs: ['vehicles'],
    fields: [
      F('reg', 'Registration number', 'text', { required: true, caps: true, placeholder: 'KBR 670E', suggest: 'vehicleReg' }), F('make', 'Make', 'text', { placeholder: 'Toyota' }), F('model', 'Model', 'text', { placeholder: 'Corolla' }), F('year', 'Year', 'int', { placeholder: '2022' }),
      F('rate', 'Daily rate (KSh)', 'money', { required: true, placeholder: '5,000' }), F('owner', 'Owner name', 'text', { placeholder: 'Mbadavi', suggest: 'ownerName' }),
      F('ownership', 'Ownership', 'choice', { choices: [yn('own', 'Own car'), yn('subhire', 'Sub-hire (someone else owns it)')] }),
      F('ownerCost', 'Sub-hire cost per day (KSh)', 'money', { placeholder: '3,500', show: v => v.ownership === 'subhire' }),
      F('billMode', 'How this car is billed', 'choice', { choices: [yn('auto', 'By day(s)'), yn('elapsed', 'By time'), yn('hours', 'By the hour')] }),
      F('billHours', 'Extra hours before another day', 'number', { placeholder: '12', show: v => v.billMode === 'elapsed' }), F('hourRate', 'Hourly rate (KSh)', 'money', { placeholder: '500', show: v => v.billMode === 'hours' }),
      F('status', 'Status', 'choice', { choices: STATUS_VEHICLE })
    ],
    blank: () => ({ ownership: 'own', billMode: 'auto', billHours: '12', status: 'Available' }),
    fromRecord: r => ({ reg: r.reg, make: r.make, model: r.model, year: r.year, rate: r.rate, owner: r.owner, ownership: r.ownership === 'subhire' ? 'subhire' : 'own', ownerCost: r.ownerCost, billMode: r.billMode || 'auto', billHours: r.billHours, hourRate: r.hourRate, status: r.status || 'Available' }),
    check: (v, c) => { const e = {}; if ((c.data.vehicles || []).some(x => !same(x.id, c.existing && c.existing.id) && squash(x.reg) === squash(v.reg))) e.reg = `A vehicle with registration ${String(v.reg).trim()} already exists. Open it from the suggestions instead`; return { errors: e, warnings: [] }; },
    plan: (v, c) => { const f = { reg: v.reg.trim().toUpperCase(), make: v.make.trim(), model: v.model.trim(), year: String(v.year || '').trim(), rate: num(parseMoney(v.rate)), owner: v.owner.trim(), status: v.status, ownership: v.ownership === 'subhire' ? 'subhire' : 'own',
      ownerCost: num(parseMoney(v.ownerCost)), billMode: v.billMode || 'auto', billHours: num(parseMoney(v.billHours)) || 12, hourRate: num(parseMoney(v.hourRate)) };
      return { ops: [c.existing ? { op: 'update', list: 'vehicles', id: c.existing.id, patch: f } : { op: 'create', list: 'vehicles', fields: f }] }; }
  },

  drivers: {
    list: 'drivers', noun: 'driver', needs: ['drivers', 'vehicles'],
    fields: [F('name', 'Full name', 'text', { required: true, placeholder: 'James Mutua', suggest: 'driverName' }), F('phone', 'Phone', 'phone', { placeholder: '0712 345 678' }), F('license', 'Licence number', 'text', { caps: true, placeholder: 'DL 123456' }),
      F('vehicleId', 'Assigned vehicle', 'pick', { pick: 'vehicles', optional: true, placeholder: 'KBR 670E' }), F('allowance', 'Allowance (KSh)', 'money', { placeholder: '1,000' }),
      F('status', 'Status', 'choice', { choices: [yn('Active', 'Active'), yn('Inactive', 'Inactive')] }), F('kind', 'Driver type', 'choice', { choices: [yn('own', 'Own driver'), yn('subhire', 'Sub-hire driver (paid per job)')] })],
    blank: () => ({ status: 'Active', kind: 'own' }),
    fromRecord: r => ({ name: r.name, phone: r.phone, license: r.license, vehicleId: r.vehicleId, allowance: r.allowance, status: r.status || 'Active', kind: r.kind === 'subhire' ? 'subhire' : 'own' }),
    check: (v, c) => { const e = {}; if ((c.data.drivers || []).some(x => !same(x.id, c.existing && c.existing.id) && squash(x.name) === squash(v.name))) e.name = `Another driver is already called ${v.name.trim()}. Open it from the suggestions instead`; return { errors: e, warnings: [] }; },
    plan: (v, c) => { const f = { name: v.name.trim(), phone: v.phone.trim(), license: v.license.trim(), vehicleId: v.vehicleId == null ? '' : v.vehicleId, allowance: num(parseMoney(v.allowance)), status: v.status, kind: v.kind === 'subhire' ? 'subhire' : 'own' };
      return { ops: [c.existing ? { op: 'update', list: 'drivers', id: c.existing.id, patch: f } : { op: 'create', list: 'drivers', fields: f }] }; }
  },

  clients: {
    list: 'clients', noun: 'client', needs: ['clients', 'drivers', 'vehicles'],
    fields: [F('name', 'Full name', 'text', { required: true, placeholder: 'Ndege Tours', suggest: 'clientName' }), F('phone', 'Phone', 'phone', { placeholder: '0712 345 678' }), F('type', 'Client type', 'choice', { choices: CLIENT_TYPES }),
      F('idnum', 'ID number', 'text', { placeholder: '12345678' }), F('dl', 'Driving licence number', 'text', { caps: true, placeholder: 'DL 123456', show: v => v.type === 'taxi' || v.type === 'self' }), F('area', 'Area', 'text', { placeholder: 'Nairobi' }),
      F('driverName', 'Driver provided (if any)', 'text', { placeholder: 'James Mutua', suggest: 'driverNameFill', show: v => v.type === 'coop' || v.type === 'walkin' }), F('driverPhone', "Driver's phone", 'phone', { placeholder: '0712 345 678', show: v => v.type === 'coop' || v.type === 'walkin' })],
    blank: () => ({ type: 'walkin' }),
    fromRecord: r => ({ name: r.name, phone: r.phone, type: clientType(r.type || 'walkin'), idnum: r.idnum, dl: r.dl, area: r.area, driverName: r.driverName, driverPhone: r.driverPhone }),
    choicesFor: (key, c) => { if (key !== 'type') return null; const t = c.existing ? clientType(c.existing.type) : ''; return t && !CLIENT_TYPES.some(x => x.value === t) ? [...CLIENT_TYPES, { value: t, label: t }] : CLIENT_TYPES; },
    check: (v, c) => { const e = {}; if (!c.existing && (c.data.clients || []).some(x => squash(x.name) === squash(v.name))) e.name = `A client called ${v.name.trim()} already exists. Open it from the suggestions instead`;
      const ph = digits(v.phone), twin = ph.length >= 6 ? (c.data.clients || []).find(x => !same(x.id, c.existing && c.existing.id) && digits(x.phone) === ph) : null; if (twin) e.phone = `This number already belongs to ${twin.name}. Open that client instead of adding a second one.`;
      return { errors: e, warnings: [] }; },
    plan: (v, c) => { const f = { name: v.name.trim(), phone: v.phone.trim(), type: v.type, area: v.area.trim(), idnum: v.idnum.trim() };
      if (v.type === 'taxi' || v.type === 'self') f.dl = v.dl.trim(); else if (v.type === 'coop' || v.type === 'walkin') { f.driverName = v.driverName.trim(); f.driverPhone = v.driverPhone.trim(); }
      return { ops: [c.existing ? { op: 'update', list: 'clients', id: c.existing.id, patch: f } : { op: 'create', list: 'clients', fields: { idnum: '', dl: '', usualReg: '', driverName: '', driverPhone: '', ...f } }] }; }
  },

  bookings: {
    list: 'bookings', noun: 'booking', needs: ['bookings', 'vehicles', 'clients', 'rentals'],
    fields: [F('vehicleId', 'Vehicle', 'pick', { pick: 'vehicles', required: true, placeholder: 'KBR 670E' }), F('clientId', 'Client', 'pick', { pick: 'clients', required: true, placeholder: 'Ndege Tours' }),
      F('pickup', 'Planned pickup', 'date', { required: true, placeholder: '15/11/2026' }), F('return', 'Planned return', 'date', { required: true, placeholder: '18/11/2026' }), F('deposit', 'Deposit (KSh)', 'money', { placeholder: '5,000' }),
      F('bookedOn', 'Booked on', 'date', { required: true }), F('status', 'Status', 'choice', { choices: [yn('Pending', 'Pending'), yn('Confirmed', 'Confirmed'), yn('Cancelled', 'Cancelled')] })],
    blank: c => ({ bookedOn: c.today, status: 'Pending' }),
    fromRecord: r => ({ vehicleId: r.vehicleId, clientId: r.clientId, pickup: r.pickup, return: r.return, deposit: r.deposit, bookedOn: r.bookedOn || '', status: r.status || 'Pending' }),
    check: (v, c) => { const e = {}, w = []; const p = parseDate(v.pickup, c.today), r = parseDate(v.return, c.today);
      if (p && r && r < p) e.return = RETURN_BEFORE;
      const g = garageMsg(c, v); if (g) e.vehicleId = g;
      if (!e.return && p && r && v.status !== 'Cancelled' && v.vehicleId != null) { const k = vehicleConflicts(c.data, v.vehicleId, p, r, { excludeBookingId: c.existing && c.existing.id }); if (k.length) w.push('This vehicle already has overlapping dates:\n' + k.join('\n')); }
      if (v.deposit !== '' && parseMoney(v.deposit) < 0) e.deposit = 'The deposit cannot be negative';
      return { errors: e, warnings: w }; },
    plan: (v, c) => { const f = { vehicleId: v.vehicleId, clientId: v.clientId, bookedOn: parseDate(v.bookedOn, c.today), pickup: parseDate(v.pickup, c.today), return: parseDate(v.return, c.today), deposit: num(parseMoney(v.deposit)), status: v.status };
      if (c.existing) { const patch = { ...f }; if (f.pickup !== c.existing.pickup) patch.reminderAck = false; return { ops: [{ op: 'update', list: 'bookings', id: c.existing.id, patch }] }; }
      return { ops: [{ op: 'create', list: 'bookings', fields: { reminderAck: false, ...f } }] }; }
  },

  rentals: {
    list: 'rentals', noun: 'rental', needs: ['rentals', 'vehicles', 'clients', 'drivers', 'payments', 'bookings', 'expenses'],
    fields: [
      F('vehicleId', 'Vehicle', 'pick', { pick: 'vehicles', required: true, placeholder: 'KBR 670E' }), F('clientId', 'Client', 'pick', { pick: 'clients', optional: true, placeholder: 'Ndege Tours' }),
      F('newClientName', '…or a new client (name)', 'text', { placeholder: 'Ndege Tours', suggest: 'rentalClient', show: (v, c) => !c.existing }), F('contract', 'Contract number', 'text', { caps: true, placeholder: 'FP-2026-001' }),
      F('pickup', 'Pickup date', 'date', { required: true, placeholder: '15/11/2026' }), F('pickupTime', 'Pickup time', 'time', { placeholder: '09:00' }), F('return', 'Return date', 'date', { required: true, placeholder: '18/11/2026' }), F('returnTime', 'Return time', 'time', { placeholder: '09:00' }),
      F('rate', 'Daily rate (KSh)', 'money', { placeholder: '5,000', hint: (v, c) => { const car = byId(c.data.vehicles, v.vehicleId); return car && num(car.rate) > 0 ? (num(parseMoney(v.rate)) === num(car.rate) ? `This car's daily rate (${fmt(car.rate)}). You can change it for this rental.` : `This car's daily rate is ${fmt(car.rate)}. Changed for this rental.`) : ''; } }), F('billMode', 'How this rental is charged', 'choice', { choices: BILL_MODES }), F('days', 'Days charged', 'int', { placeholder: '3', show: v => v.billMode === 'days' }),
      F('amount', 'Amount (blank = worked out)', 'money', { placeholder: '15,000' }), F('fuel', 'Fuel you carried (KSh)', 'money', { placeholder: '1,000' }), F('fuelCharge', 'Fuel charged to the client (KSh)', 'money', { placeholder: '1,200' }), F('allowance', 'Driver allowance (KSh)', 'money', { placeholder: '500' }),
      F('driverId', 'Driver', 'pick', { pick: 'drivers', optional: true, placeholder: 'James Mutua' }), F('status', 'Status', 'choice', { choices: [yn('Active', 'Active'), yn('Completed', 'Completed'), yn('Cancelled', 'Cancelled')] }),
      F('subhireCost', 'Sub-hire cost (KSh)', 'money', { placeholder: '3,500', show: (v, c) => subhireCar(c.data, v.vehicleId) }), F('subhirePaid', 'Owner paid', 'bool', { show: (v, c) => subhireCar(c.data, v.vehicleId) }),
      F('mileage', 'Mileage (km)', 'money', { placeholder: '84,500' }), F('invoice', 'Invoice number', 'text', { caps: true, placeholder: 'INV-001' }), F('receipt', 'Receipt number', 'text', { caps: true, placeholder: 'RCPT-001' })
    ],
    blank: () => ({ billMode: '', status: 'Active', subhirePaid: false }),
    fromRecord: r => ({ vehicleId: r.vehicleId, clientId: r.clientId, contract: r.contract, pickup: r.pickup, pickupTime: r.pickupTime, return: r.return, returnTime: r.returnTime, rate: r.rate, billMode: r.billMode || '', days: r.billMode === 'days' ? r.days : '',
      amount: r.billMode === 'fixed' ? r.amount : '', fuel: r.fuel, fuelCharge: r.fuelCharge, allowance: r.allowance, driverId: r.driverId, status: r.status || 'Active', subhireCost: r.subhireCost, subhirePaid: !!r.subhirePaid, mileage: r.mileage, invoice: r.invoice, receipt: r.receipt }),
    /* picking the car fills its daily rate (and its sub-hire cost is left to the days x cost rule); picking the client fills nothing else */
    onChange: (key, v, c) => { if (key === 'vehicleId' && v.vehicleId != null) { const car = byId(c.data.vehicles, v.vehicleId); if (car && (v.rate === '' || v.rate == null || c.rateFromCar)) return { rate: car.rate ? String(car.rate) : v.rate, __rateFromCar: true }; } return null; },
    check: (v, c) => rentalCheck(v, c),
    plan: (v, c) => rentalPlan(v, c)
  },

  payments: {
    list: 'payments', noun: 'payment', needs: ['payments', 'rentals', 'vehicles', 'clients'],
    fields: [F('rentalId', 'Rental', 'pick', { pick: 'rentalsOwing', required: true, placeholder: 'KBR 670E · Ndege Tours' }), F('amount', 'Amount received (KSh)', 'money', { required: true, placeholder: '5,000' }), F('date', 'Date', 'date', { required: true, placeholder: '15/11/2026' }),
      F('method', 'Method', 'choice', { choices: METHODS }), F('note', 'Note', 'text', { placeholder: 'M-Pesa transaction or receipt details' })],
    blank: c => ({ date: c.today, method: 'Cash' }),
    fromRecord: r => ({ rentalId: r.rentalId, amount: r.amount, date: r.date, method: r.method || 'Other', note: r.note }),
    choicesFor: (key, c) => (key === 'method' && c.existing && c.existing.method && !METHODS.some(m => m.value === c.existing.method) ? [...METHODS, { value: c.existing.method, label: c.existing.method }] : null),
    /* picking the rental fills the amount with what it still owes */
    onChange: (key, v, c) => { if (key === 'rentalId' && v.rentalId != null) { const r = byId(c.data.rentals, v.rentalId); const owed = owedOn(c.data, r, c.existing && c.existing.id); if (owed > 0 && (v.amount === '' || v.amount == null || c.amountFromRental)) return { amount: String(owed), __amountFromRental: true }; } return null; },
    check: (v, c) => { const e = {}, a = parseMoney(v.amount); if (isFuture(v.date, c)) e.date = FUTURE_MSG; const r = byId(c.data.rentals, v.rentalId);
      if (!Number.isNaN(a) && a <= 0) e.amount = 'Enter an amount above 0.';
      else if (r && !Number.isNaN(a)) { const left = owedOn(c.data, r, c.existing && c.existing.id); if (a > left) e.amount = `That is more than the ${ksh0(left)} still owed on this rental. Enter up to ${ksh0(left)}.`; }
      return { errors: e, warnings: [] }; },
    plan: (v, c) => { const f = { rentalId: v.rentalId, date: parseDate(v.date, c.today), amount: num(parseMoney(v.amount)), method: v.method, note: v.note.trim() };
      if (c.existing) { const patch = { ...f }; if (c.existing.rentalId === '' && f.rentalId !== '') patch.linkKind = 'manual'; return { ops: [{ op: 'update', list: 'payments', id: c.existing.id, patch }] }; }
      return { ops: [{ op: 'create', list: 'payments', fields: { ...f, xlRef: '', source: 'Entered in the app', invoiceNo: '', linkKind: 'manual' } }] }; }
  },

  expenses: {
    list: 'expenses', noun: 'expense', needs: ['expenses', 'vehicles', 'clients', 'rentals'],
    fields: [
      F('category', 'Category', 'choice', { wrap: true }), F('vehicleId', 'Vehicle', 'pick', { pick: 'vehicles', optional: true, blankLabel: 'Office / general', placeholder: 'KBR 670E' }), F('date', 'Date', 'date', { required: true, placeholder: '15/11/2026' }),
      F('desc', 'Description', 'text', { placeholder: 'Engine service' }), F('amount', 'Amount (KSh)', 'money', { required: true, placeholder: '8,500' }), F('qty', 'Quantity', 'number', { placeholder: '1' }),
      F('account', 'Paid from', 'choice', { choices: [yn('Ola', 'Ola account'), yn('Outside', 'Outside (cash)')], show: v => v.category === 'Fuel' }),
      F('rentalId', 'Fuel for rental', 'pick', { pick: 'rentalsAll', optional: true, placeholder: 'KBR 670E · Ndege Tours', show: v => v.category === 'Fuel' }),
      F('billable', 'Office-fronted: bill this fuel to a client', 'bool', { show: v => v.category === 'Fuel' }),
      F('billClientId', 'Client to charge', 'pick', { pick: 'clients', placeholder: 'Ndege Tours', show: v => v.category === 'Fuel' && !!v.billable }), F('chargeAmount', 'Amount to charge the client (KSh)', 'money', { placeholder: '5,000', show: v => v.category === 'Fuel' && !!v.billable })
    ],
    categories: data => [...new Set([...BASE_CATEGORIES, ...(data.expenses || []).map(x => x.category).filter(Boolean)])].map(v => ({ value: v, label: v })),
    blank: c => ({ category: c.preset && c.preset.category ? c.preset.category : 'Garage', date: c.today, qty: '1', account: 'Ola', billable: false }),
    fromRecord: r => ({ category: r.category || 'Other', vehicleId: r.vehicleId, date: r.date, desc: r.desc, amount: r.amount, qty: r.qty == null ? '1' : r.qty, account: r.account === 'Outside' ? 'Outside' : 'Ola', rentalId: r.rentalId, billable: !!r.billable, billClientId: r.billClientId, chargeAmount: r.chargeAmount }),
    /* a fuel fill with a car and a date offers the rental that car was on */
    onChange: (key, v, c) => { if ((key === 'vehicleId' || key === 'date' || key === 'category') && v.category === 'Fuel' && v.vehicleId != null && (v.rentalId == null || c.rentalAuto)) { const rid = rentalForFill(c.data, v.vehicleId, parseDate(v.date, c.today)); return { rentalId: rid === '' ? null : rid, __rentalAuto: true }; } return null; },
    check: (v, c) => { const e = {}, a = parseMoney(v.amount); if (isFuture(v.date, c)) e.date = FUTURE_MSG; if (!Number.isNaN(a) && a <= 0) e.amount = 'Enter an amount above 0.';
      if (v.category === 'Fuel' && v.billable) { if (v.billClientId == null) e.billClientId = 'Pick the client to charge'; if (v.chargeAmount !== '' && parseMoney(v.chargeAmount) < 0) e.chargeAmount = 'Not below zero'; }
      if (v.category === 'Fuel' && v.vehicleId == null && v.rentalId == null) e.vehicleId = 'Pick the car this fuel went into';
      const w = [], dt = parseDate(v.date, c.today);
      if (v.category === 'Fuel' && v.vehicleId != null && dt && !Number.isNaN(a) && (c.data.expenses || []).some(x => x.category === 'Fuel' && !same(x.id, c.existing && c.existing.id) && same(x.vehicleId, v.vehicleId) && x.date === dt && Math.round(num(x.amount) * 100) === Math.round(a * 100))) w.push(DUP_FUEL);
      return { errors: e, warnings: w }; },
    plan: (v, c) => { const fuel = v.category === 'Fuel', rental = fuel && v.rentalId != null ? byId(c.data.rentals, v.rentalId) : null;
      const vehicleId = v.vehicleId != null ? v.vehicleId : (rental ? rental.vehicleId : '');
      const f = { vehicleId, date: parseDate(v.date, c.today), category: v.category, desc: v.desc.trim() || (fuel ? 'Fuel' + (rental && rental.contract ? ' — ' + rental.contract : '') : ''), qty: num(parseMoney(v.qty)) || 1, amount: num(parseMoney(v.amount)),
        billable: fuel && !!v.billable, billClientId: fuel && v.billable ? v.billClientId : null, chargeAmount: fuel && v.billable ? num(parseMoney(v.chargeAmount)) : 0, rentalId: rental ? rental.id : null };
      if (fuel) f.account = v.account === 'Outside' ? 'Outside' : 'Ola';
      if (c.existing) return { ops: [{ op: 'update', list: 'expenses', id: c.existing.id, patch: f }] };
      return { ops: [{ op: 'create', list: 'expenses', fields: { ...f, source: fuel ? 'fuel' : 'manual', xlRef: '' } }] }; }
  },

  fuelTopup: {
    list: 'fuelAccount', noun: 'fuel top-up', needs: ['fuelAccount'],
    fields: [F('amount', 'Amount paid in (KSh)', 'money', { required: true, placeholder: '20,000' }), F('date', 'Date', 'date', { required: true, placeholder: '15/11/2026' }), F('note', 'Note', 'text', { placeholder: 'M-Pesa transaction or receipt details' })],
    blank: c => ({ date: c.today }),
    fromRecord: r => ({ amount: r.amount, date: r.date, note: r.note || r.desc || '' }),
    check: (v, c) => { const e = {}, a = parseMoney(v.amount); if (isFuture(v.date, c)) e.date = FUTURE_MSG; if (!Number.isNaN(a) && a <= 0) e.amount = 'Enter an amount above 0.'; return { errors: e, warnings: [] }; },
    plan: (v, c) => { const f = { kind: 'topup', date: parseDate(v.date, c.today), amount: num(parseMoney(v.amount)), note: v.note.trim() };
      return { ops: [c.existing ? { op: 'update', list: 'fuelAccount', id: c.existing.id, patch: f } : { op: 'create', list: 'fuelAccount', fields: f }] }; }
  },

  /* a coop schedule line that is not in Rentals yet ("To complete") */
  coops: {
    list: 'coops', noun: 'coop line', needs: ['coops', 'rentals', 'clients', 'vehicles'],
    fields: [F('name', 'Name of staff served', 'text', { required: true, caps: true, placeholder: 'James Mutua' }), F('department', 'Branch department', 'text', { caps: true, placeholder: 'Nairobi Branch' }), F('start', 'From', 'date', { required: true, placeholder: '15/11/2026' }), F('end', 'To', 'date', { placeholder: '18/11/2026' }),
      F('days', 'No of hire days', 'int', { placeholder: '3' }), F('contract', 'Job card / contract no', 'text', { placeholder: 'JOB-001' }), F('amount', 'Vehicle charge (KSh, without VAT)', 'money', { required: true, placeholder: '15,000' }), F('kmOut', 'KMs out', 'number', { placeholder: '84,500' }), F('kmIn', 'KMs in', 'number', { placeholder: '84,750' })],
    blank: c => ({ start: c.today, end: '' }),
    fromRecord: r => ({ name: r.name, department: r.department || '', start: r.start, end: r.end || '', days: r.days || '', contract: r.contract || '', amount: r.amount, kmOut: r.kmOut || '', kmIn: r.kmIn || '' }),
    check: (v, c) => { const e = {}, a = parseMoney(v.amount); if (!Number.isNaN(a) && a <= 0) e.amount = 'Enter an amount above 0.';
      const s0 = parseDate(v.start, c.today), e0 = parseDate(v.end, c.today); if (s0 && e0 && e0 < s0) e.end = RETURN_BEFORE;
      if (num(parseMoney(v.kmIn)) && num(parseMoney(v.kmOut)) && num(parseMoney(v.kmIn)) < num(parseMoney(v.kmOut))) e.kmIn = 'KMs in cannot be less than KMs out.'; return { errors: e, warnings: [] }; },
    plan: (v, c) => { const f = { name: String(v.name).trim().toUpperCase(), department: String(v.department).trim().toUpperCase(), start: parseDate(v.start, c.today), end: parseDate(v.end, c.today) || parseDate(v.start, c.today), days: num(v.days), contract: String(v.contract).trim(),
        amount: num(parseMoney(v.amount)), kmOut: num(parseMoney(v.kmOut)), kmIn: num(parseMoney(v.kmIn)) };
      return { ops: [c.existing ? { op: 'update', list: 'coops', id: c.existing.id, patch: f } : { op: 'create', list: 'coops', fields: { ...f, driverPay: 0, allowance: 0, fuel: 0, withVat: 0, note: '', rentalId: '', status: 'todo', xlRef: '' } }] }; }
  },

  /* a coop line made from a coop rental: pick the rental, type staff, department, KMs and the contract no. Fuel, driver and allowance are read from the rental. */
  coopFromRental: {
    list: 'coops', noun: 'coop line', needs: ['coops', 'rentals', 'clients', 'vehicles'],
    fields: [F('rentalId', 'Coop rental', 'pick', { pick: 'coopRentals', required: true, placeholder: 'KBR 670E · Ndege Tours' }), F('name', 'Name of staff served', 'text', { caps: true, placeholder: 'James Mutua' }), F('department', 'Branch department', 'text', { caps: true, placeholder: 'Nairobi Branch' }),
      F('kmOut', 'KMs out', 'number', { placeholder: '84,500' }), F('kmIn', 'KMs in', 'number', { placeholder: '84,750' }), F('contract', 'Job card / contract no', 'text', { placeholder: 'JOB-001' })],
    blank: () => ({}),
    onChange: (key, v, c) => { if (key !== 'rentalId' || v.rentalId == null || v.rentalId === '') return {}; const r = byId(c.data.rentals, v.rentalId), cp = (c.data.coops || []).find(x => same(x.rentalId, v.rentalId)), L = lookups(c.data);
      return r ? { name: (cp && cp.name) || L.clientName(r.clientId) || '', department: (cp && cp.department) || '', kmOut: cp && cp.kmOut ? cp.kmOut : '', kmIn: cp && cp.kmIn ? cp.kmIn : '', contract: (cp && cp.contract) || r.contract || '' } : {}; },
    check: (v, c) => { const e = {}; if (v.rentalId == null || v.rentalId === '') e.rentalId = NEEDED; const o = num(parseMoney(v.kmOut)), i = num(parseMoney(v.kmIn)); if (o && i && i < o) e.kmIn = 'KMs in cannot be less than KMs out.'; return { errors: e, warnings: [] }; },
    plan: (v, c) => { const r = byId(c.data.rentals, v.rentalId), cp = (c.data.coops || []).find(x => same(x.rentalId, v.rentalId)), L = lookups(c.data), up = x => String(x || '').trim().toUpperCase(), ops = [];
      const f = { name: up(v.name) || (cp && cp.name) || up(L.clientName(r.clientId)), department: up(v.department), kmOut: num(parseMoney(v.kmOut)), kmIn: num(parseMoney(v.kmIn)), contract: String(v.contract || '').trim() };
      if (cp) ops.push({ op: 'update', list: 'coops', id: cp.id, patch: f });
      else ops.push({ op: 'create', list: 'coops', fields: { ...f, clientId: r.clientId, start: r.pickup || '', end: r.return || r.pickup || '', days: num(r.days), amount: num(r.amount), driverPay: 0, allowance: num(r.allowance), fuel: num(r.fuel), withVat: 0, note: '', rentalId: r.id, status: 'done', xlRef: '' } });
      const rp = {}; if (f.contract) rp.contract = f.contract; if (f.kmIn > f.kmOut && f.kmOut > 0) rp.mileage = f.kmIn - f.kmOut;
      if (Object.keys(rp).length) ops.push({ op: 'update', list: 'rentals', id: r.id, patch: rp });
      return { ops }; }
  }
};

/* a car in the garage cannot be rented or booked (an old record keeps its car) */
const garageMsg = (c, v) => { const car = byId(c.data.vehicles, v.vehicleId); return car && car.status === 'Maintenance' && v.status !== 'Cancelled' && !(c.existing && same(c.existing.vehicleId, car.id)) ? `${car.reg} is in the garage. Choose another car.` : ''; };
const subhireCar = (data, vehicleId) => { const car = byId(data.vehicles, vehicleId); return !!car && car.ownership === 'subhire'; };

/* ---------- rentals: preview, checks, plan ---------- */
function draftOf(v, today) {
  return { pickup: parseDate(v.pickup, today), pickupTime: parseTime(v.pickupTime), return: parseDate(v.return, today), returnTime: parseTime(v.returnTime), rate: num(parseMoney(v.rate)),
    billMode: v.billMode || '', days: num(parseMoney(v.days)), amount: num(parseMoney(v.amount)) };
}
export function rentalPreview(v, c) {
  const car = byId(c.data.vehicles, v.vehicleId), d = draftOf(v, c.today);
  if (!car || !d.pickup || !d.return || d.return < d.pickup) return '';
  const ch = charge(d, car), amount = d.amount > 0 ? d.amount : ch.amount;
  return `${ch.label}  =  ${fmt(amount)}${d.amount > 0 ? '' : ' (worked out)'}`;
}
function rentalCheck(v, c) {
  const e = {}, w = [], d = draftOf(v, c.today), car = byId(c.data.vehicles, v.vehicleId);
  if (v.clientId == null && !String(v.newClientName || '').trim()) e.clientId = 'Pick the client, or type a new client\'s name';
  { const g = garageMsg(c, v); if (g) e.vehicleId = g; }
  if (d.pickup && d.return) {
    if (d.return < d.pickup) e.return = RETURN_BEFORE;
    else if (d.pickup === d.return && d.pickupTime && d.returnTime && d.returnTime < d.pickupTime) e.returnTime = "The return time can't be before the pickup time on the same day";
  }
  const mode = (d.billMode || (car && car.billMode) || 'auto');
  if (mode === 'fixed' && !(d.amount > 0)) e.amount = 'Enter the agreed amount';
  if (mode === 'days' && !(d.days > 0)) e.days = 'Enter the days to charge';
  if (mode !== 'fixed' && !(d.rate > 0) && !(car && num(car.rate) > 0)) e.rate = 'The daily rate must be more than zero';
  for (const k of ['fuel', 'fuelCharge', 'allowance', 'mileage', 'subhireCost']) if (v[k] !== '' && v[k] != null && parseMoney(v[k]) < 0) e[k] = 'Not below zero';
  if (!e.return && d.pickup && d.return && v.status !== 'Cancelled' && v.vehicleId != null) { const k = vehicleConflicts(c.data, v.vehicleId, d.pickup, d.return, { excludeRentalId: c.existing && c.existing.id }); if (k.length) w.push('This vehicle already has overlapping dates:\n' + k.join('\n')); }
  return { errors: e, warnings: w };
}
function rentalPlan(v, c) {
  const car = byId(c.data.vehicles, v.vehicleId) || {}, d = draftOf(v, c.today), ch = charge({ ...d, rate: d.rate || num(car.rate) }, car), dur = duration(d);
  const days = ch.unit === 'day' ? ch.units : (dur.ok ? dur.calendarDays : 1);
  const amount = d.amount > 0 ? d.amount : ch.amount;
  const name = String(v.newClientName || '').trim();
  const known = v.clientId == null && name ? (c.data.clients || []).find(x => squash(x.name) === squash(name)) : null;
  const clientId = v.clientId != null ? v.clientId : (known ? known.id : null);
  const client = byId(c.data.clients, clientId);
  const fuel = num(parseMoney(v.fuel)), fuelChargeRaw = String(v.fuelCharge == null ? '' : v.fuelCharge).trim();
  const f = { vehicleId: v.vehicleId, clientId, contract: v.contract.trim(), invoice: v.invoice.trim(), receipt: v.receipt.trim(), pickup: d.pickup, pickupTime: d.pickupTime, return: d.return, returnTime: d.returnTime,
    rate: d.rate || num(car.rate), days, mileage: num(parseMoney(v.mileage)), amount, status: v.status, fuel, fuelCharge: fuelChargeRaw === '' ? 0 : num(parseMoney(fuelChargeRaw)),
    type: client ? clientType(client.type || 'walkin') : (c.existing && c.existing.type) || 'walkin', driverId: v.driverId == null ? null : v.driverId, billMode: d.billMode || '', hours: dur.ok ? dur.hours : null, allowance: num(parseMoney(v.allowance)),
    subhireCost: car.ownership === 'subhire' ? (String(v.subhireCost == null ? '' : v.subhireCost).trim() !== '' ? num(parseMoney(v.subhireCost)) : num(car.ownerCost) * days) : 0, subhirePaid: car.ownership === 'subhire' && !!v.subhirePaid };
  const ops = []; let ci = -1;
  if (clientId == null) { ci = ops.length; ops.push({ op: 'create', list: 'clients', fields: { name, phone: '', idnum: '', dl: '', usualReg: '', driverName: '', driverPhone: '', type: 'walkin', area: '' } }); f.type = 'walkin'; }
  const fieldsNow = res => { const out = { ...f, clientId: ci >= 0 ? res[ci].id : clientId }; if (car.ownership === 'subhire') syncOwnerFromTick(out); return out; };
  const ri = ops.length;
  if (c.existing) {
    const merged = res => { const out = { ...c.existing, ...fieldsNow(res) }; if (car.ownership === 'subhire') syncOwnerFromTick(out); return out; };
    ops.push({ op: 'update', list: 'rentals', id: c.existing.id, patch: res => merged(res) });
  } else ops.push({ op: 'create', list: 'rentals', fields: res => fieldsNow(res) });
  if (c.existing && c.existing.status === 'Active' && (!same(c.existing.vehicleId, v.vehicleId) || v.status !== 'Active')) {
    const previousCar = byId(c.data.vehicles, c.existing.vehicleId);
    const anotherActiveRental = (c.data.rentals || []).some(r => !same(r.id, c.existing.id) && same(r.vehicleId, c.existing.vehicleId) && r.status === 'Active');
    if (previousCar && previousCar.status === 'Rented' && !anotherActiveRental) {
      ops.push({ op: 'update', list: 'vehicles', id: previousCar.id, patch: { status: 'Available' } });
    }
  }
  if (v.status === 'Active' && car.id != null && car.status !== 'Rented') ops.push({ op: 'update', list: 'vehicles', id: car.id, patch: { status: 'Rented' } });
  /* the fuel the office carried is also a Fuel expense, linked to the rental (not for rentals that came from Excel: their fuel already arrived on its own) */
  const mirror = c.existing ? (c.data.expenses || []).find(x => x.source === 'rental' && same(x.rentalId, c.existing.id)) : null;
  if (!(c.existing && c.existing.xlRef)) {
    const rentalId = res => (c.existing ? c.existing.id : res[ri].id);
    const row = res => ({ vehicleId: f.vehicleId, date: f.pickup, category: 'Fuel', desc: 'Fuel — rental' + (f.contract ? ' ' + f.contract : ''), qty: 1, amount: fuel, billable: true, billClientId: ci >= 0 ? res[ci].id : clientId, chargeAmount: f.fuelCharge, source: 'rental', rentalId: rentalId(res) });
    if (fuel > 0) ops.push(mirror ? { op: 'update', list: 'expenses', id: mirror.id, patch: res => row(res) } : { op: 'create', list: 'expenses', fields: res => row(res) });
    else if (mirror) ops.push({ op: 'remove', list: 'expenses', id: mirror.id });
  }
  return { ops };
}

/* ---------- the generic parts ---------- */
export function formFor(id) { return FORMS[id] || null; }
export const formIdFor = (list, record) => (list === 'fuelAccount' ? (record && record.kind === 'opening' ? null : 'fuelTopup') : FORMS[list] ? list : null);
export const FORM_NEEDS = id => (FORMS[id] ? FORMS[id].needs : []);
export const ADD_BUTTONS = {
  vehicles: [{ label: 'Add vehicle', form: 'vehicles' }], drivers: [{ label: 'Add driver', form: 'drivers' }], clients: [{ label: 'Add client', form: 'clients' }], bookings: [{ label: 'Add booking', form: 'bookings' }],
  rentals: [{ label: 'Add rental', form: 'rentals' }], payments: [{ label: 'Add payment', form: 'payments' }], expenses: [{ label: 'Add expense', form: 'expenses' }],
  coop: [{ label: 'From a coop rental', form: 'coopFromRental' }, { label: 'Not yet in Rentals', form: 'coops' }],
  fuel: [{ label: 'Add fuel fill', form: 'expenses', preset: { category: 'Fuel' } }, { label: 'Add top-up', form: 'fuelTopup' }]
};
export const formTitle = (id, existing) => { const f = FORMS[id]; return f ? (existing ? 'Edit ' : 'New ') + f.noun : ''; };

/* a rental's fuel line, or a fuel line that came from one, is changed on the rental */
export const editBlocked = (list, record) => (list === 'expenses' && record && record.source === 'rental' ? 'This fuel line was written by a rental. Change the fuel on the rental and this line follows.' : '');

export function choicesOf(formId, field, c) {
  const f = FORMS[formId];
  if (field.key === 'category' && f.categories) return f.categories(c.data);
  return (f.choicesFor && f.choicesFor(field.key, c)) || field.choices || [];
}

export function blankValues(formId, c) {
  const f = FORMS[formId], base = f.blank ? f.blank(c) : {}, out = {};
  f.fields.forEach(fl => { out[fl.key] = fl.type === 'bool' ? false : fl.type === 'pick' ? null : ''; });
  Object.assign(out, base, c.preset && c.preset.values ? c.preset.values : {});
  return out;
}
export function valuesFromRecord(formId, record, c) {
  const f = FORMS[formId], src = f.fromRecord(record), out = {};
  /* a rental's amount is only filled in when it differs from what the car's rate and the dates give (an agreed or imported figure), so saving a change never quietly re-prices it */
  if (formId === 'rentals' && c) { const car = byId(c.data.vehicles, record.vehicleId); if (car) { const calc = charge({ ...record, amount: 0 }, car).amount; src.amount = record.billMode === 'fixed' || Math.round(num(record.amount)) !== Math.round(calc) ? record.amount : ''; } }
  f.fields.forEach(fl => { const x = src[fl.key]; out[fl.key] = fl.type === 'bool' ? !!x : fl.type === 'pick' ? (x === '' || x === undefined ? null : x) : (x == null ? '' : String(x)); });
  return out;
}
export const visibleFields = (formId, values, c) => FORMS[formId].fields.filter(fl => !fl.show || fl.show(values, c));

/* a field changed: some forms fill other fields (picking a car fills its rate). Returns the new values. */
export function applyChange(formId, key, value, values, c, auto = {}) {
  const f = FORMS[formId], next = { ...values, [key]: value };
  if (f.onChange) {
    const more = f.onChange(key, next, { ...c, rateFromCar: auto.rate, amountFromRental: auto.amount, rentalAuto: auto.rental });
    if (more) { for (const [k, v] of Object.entries(more)) { if (k === '__rateFromCar') auto.rate = true; else if (k === '__amountFromRental') auto.amount = true; else if (k === '__rentalAuto') auto.rental = true; else next[k] = v; } }
  }
  if (key === 'rate') auto.rate = false; if (key === 'amount') auto.amount = false; if (key === 'rentalId' && formId === 'expenses') auto.rental = false;
  return next;
}

/* the whole check: field by field (empty, number, date, time), then the form's own rules. Returns { errors, warnings, clean } with clean = the values as the record will hold them. */
export function checkForm(formId, values, c) {
  const f = FORMS[formId], errors = {}, clean = { ...values };
  for (const fl of visibleFields(formId, values, c)) {
    const raw = values[fl.key], text = typeof raw === 'string' ? raw.trim() : raw;
    if (fl.type === 'pick' || fl.type === 'bool') { if (fl.required && (raw == null || raw === '')) errors[fl.key] = NEEDED; continue; }
    if (fl.type === 'choice') continue;
    if (text === '' || text == null) { if (fl.required && !(formId === 'rentals' && fl.key === 'clientId')) errors[fl.key] = NEEDED; continue; }
    if (fl.type === 'date') { const d = parseDate(text, c.today); if (!d) errors[fl.key] = `${fl.label}: not a date I can read (try 10/11/2026)`; else clean[fl.key] = d; }
    else if (fl.type === 'time') { const t = parseTime(text); if (!t) errors[fl.key] = `${fl.label}: not a time I can read (try 14:30)`; else clean[fl.key] = t; }
    else if (fl.type === 'money' || fl.type === 'number' || fl.type === 'int') { const n = parseMoney(text); if (Number.isNaN(n)) errors[fl.key] = `${fl.label}: enter a number`; else if (fl.type === 'int' && !Number.isInteger(n)) errors[fl.key] = `${fl.label}: a whole number`; }
  }
  const own = f.check ? f.check({ ...values, ...clean }, c) : { errors: {}, warnings: [] };
  Object.keys(own.errors).forEach(k => { if (!errors[k]) errors[k] = own.errors[k]; });
  return { errors, warnings: own.warnings, clean, ok: Object.keys(errors).length === 0 };
}

/* the plan of saves (ops for records.saveBatch). Call only after checkForm says ok. */
export function planSave(formId, values, c) { const check = checkForm(formId, values, c); return FORMS[formId].plan({ ...values, ...check.clean }, c); }

/* ---------- quick money actions from the Audit ---------- */
/* "Mark paid" on a sub-hire car or driver line: the status and its date, the same fields the desktop keeps */
export function markPaidPatch(kind, rental, date) {
  const r = { ...rental };
  if (kind === 'owner') { setOwnerStatus(r, 'paid', date); return { subhireStatus: r.subhireStatus, subhirePaid: r.subhirePaid, subhirePaidDate: r.subhirePaidDate }; }
  setDriverStatus(r, 'paid', date);
  return { driverStatus: r.driverStatus, driverStatusDate: r.driverStatusDate };
}

/* the month an existing record is dated in, when that is before this month: changing it asks first (the desktop asks for authorisation on earlier months) */
const DATE_KEY = { rentals: 'pickup', bookings: 'pickup', payments: 'date', expenses: 'date', fuelTopup: 'date' };
export function recordMonth(formId, record, today = todayISO()) {
  const d = record && record[DATE_KEY[formId]];
  if (!/^\d{4}-\d{2}/.test(String(d || ''))) return '';
  const ym = String(d).slice(0, 7);
  return ym < today.slice(0, 7) ? ym : '';
}
