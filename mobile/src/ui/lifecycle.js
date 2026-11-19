/* Exit, Restore and Delete for the three registers: Vehicles, Drivers, Clients (UI_SPEC 12 #4 and #5). No React.
   Exit never removes a record, so old rentals and payments stay correct. Vehicles and drivers use their existing status (Inactive);
   clients get an optional `status` field ('Exited'), the one extra field, agreed for Step 4. Restore puts them back. */
import { lookups } from './tables.js';

export const REGISTERS = ['vehicles', 'drivers', 'clients'];
export const isRegister = list => REGISTERS.includes(list);
export const FOOTER_HINT = 'These records stay here every month and every year. They only go when you exit or delete them.';
export const EMPTY_TEXT = { vehicles: 'No vehicles yet. Tap + to add the first one.', drivers: 'No drivers yet. Tap + to add the first one.', clients: 'No clients yet. Tap + to add the first one.' };
const NOUN = { vehicles: 'vehicle', drivers: 'driver', clients: 'client' };

export const isExited = (list, r) => !!r && (list === 'clients' ? r.status === 'Exited' : isRegister(list) && r.status === 'Inactive');
export const exitPatch = list => (list === 'clients' ? { status: 'Exited' } : { status: 'Inactive' });
export const restorePatch = list => (list === 'vehicles' ? { status: 'Available' } : { status: 'Active' });
export const nameOf = (list, r) => (list === 'vehicles' ? r.reg : r.name) || 'This record';
export const noun = list => NOUN[list] || 'record';

/* the words on the confirm sheets and in the toasts */
export function confirmText(action, list, r) {
  const n = nameOf(list, r);
  if (action === 'exit') return { title: `Mark ${n} as exited?`, body: `It leaves the ${noun(list)} list but every old record that uses it stays correct. You can restore it any time.`, button: 'Mark as exited' };
  if (action === 'restore') return { title: `Restore ${n}?`, body: `It comes back into the ${noun(list)} list.`, button: 'Restore' };
  return { title: `Delete ${n}?`, body: `This removes the ${noun(list)} for good. It is removed on the computer at the next sync. If old records use it, Exit is the safer choice.`, button: 'Delete' };
}
export const toastFor = (action, list, r) => `${nameOf(list, r)} ${action === 'exit' ? 'marked as exited' : action === 'restore' ? 'restored' : 'deleted'}`;

/* how many records use this one (shown before a delete) */
export function usage(list, id, data) {
  const same = x => String(x) === String(id), n = key => (data[key] || []).filter(r => same(r[list === 'vehicles' ? 'vehicleId' : list === 'drivers' ? 'driverId' : 'clientId'])).length;
  if (list === 'vehicles') return { rentals: n('rentals'), bookings: n('bookings'), expenses: n('expenses') };
  if (list === 'drivers') return { rentals: n('rentals') };
  if (list === 'clients') return { rentals: n('rentals'), bookings: n('bookings') };
  return {};
}
export function usageText(u) {
  const parts = Object.entries(u).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${v === 1 ? k.replace(/s$/, '') : k}`);
  return parts.length ? `It is used by ${parts.join(', ')}.` : '';
}
export { lookups };
