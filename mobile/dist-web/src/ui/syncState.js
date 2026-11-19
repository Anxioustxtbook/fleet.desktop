/* The "Synced / Not synced" pill on Home (UI_SPEC 12 #9). No React.
   Not synced = records waiting for the computer, a week or more since the last sync, or never synced.
   The connection words come from barState, as before. */
export const WEEK_DAYS = 7;
export function daysSince(iso, now = new Date()) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : Math.max(0, Math.floor((now.getTime() - d.getTime()) / 864e5));
}
export function syncPill({ bar, paired, lastSyncAt, waiting = 0, now = new Date() }) {
  if (bar && bar.tone === 'sy') return { label: 'Syncing', kind: 'busy', red: false, a11y: `${bar.text}. Open Connect` };
  if (bar && bar.tone === 'ask') return { label: 'Waiting', kind: 'wait', red: false, a11y: `${bar.text}. Open Connect` };
  const days = daysSince(lastSyncAt, now), old = !paired || days === null || days >= WEEK_DAYS, pending = old || waiting > 0;
  const why = [!paired ? 'not connected to a computer' : days === null ? 'never synced' : days >= WEEK_DAYS ? `last sync ${days} days ago` : '', waiting > 0 ? `${waiting} ${waiting === 1 ? 'record' : 'records'} waiting` : ''].filter(Boolean).join(', ');
  return { label: pending ? 'Not synced' : 'Synced', kind: pending ? 'old' : 'ok', red: pending, days, waiting, a11y: `${pending ? 'Not synced' : 'Synced'}${why ? ': ' + why : ''}. Open Connect` };
}
/* records the computer does not have yet, read from the existing change log (nothing in src/sync or src/db is touched) */
export async function waitingCount(records) {
  try { const { changes } = await records.localChanges(); return changes.length; } catch (e) { return 0; }
}
