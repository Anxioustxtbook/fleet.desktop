/* Settings that stay on this phone only: the look (Light / Dark / phone), Display size, Summary / Full list,
   and later the pictures and the notification choices. They are kept in one small file of their own, NOT in the
   phone's database, so they are never sent in a sync and never enter the developer backup.

   createPrefs(files) needs only { read(), write(text) } (the phone's file adapter is in localPrefsFile.js; tests use memory). */
import { DEFAULT_Z, normalizeZ } from './ui/scale.js';
import { cleanPhotos } from './ui/photos.js';

export const PREF_DEFAULTS = Object.freeze({
  theme: 'auto', zoom: DEFAULT_Z, recordsView: 'sum', tourDone: false, guidanceEnabled: true,
  notes: '', floatingAddEnabled: true, floatingAddCorner: 'bottom-right',
  profile: Object.freeze({ name: 'Mbadavi', phone: '', email: '' })
});
const THEMES = ['auto', 'light', 'dark'];
const VIEWS = ['sum', 'desk'];
const FLOATING_ADD_CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

export function cleanPrefs(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    ...r,
    theme: THEMES.includes(r.theme) ? r.theme : PREF_DEFAULTS.theme,
    zoom: normalizeZ(r.zoom),
    recordsView: VIEWS.includes(r.recordsView) ? r.recordsView : PREF_DEFAULTS.recordsView,
    tourDone: r.tourDone === true,
    guidanceEnabled: r.guidanceEnabled !== false,
    notes: typeof r.notes === 'string' ? r.notes.slice(0, 2000) : PREF_DEFAULTS.notes,
    floatingAddEnabled: r.floatingAddEnabled !== false,
    floatingAddCorner: FLOATING_ADD_CORNERS.includes(r.floatingAddCorner) ? r.floatingAddCorner : PREF_DEFAULTS.floatingAddCorner,
    profile: {
      name: String(r.profile && r.profile.name || PREF_DEFAULTS.profile.name).trim().slice(0, 80),
      phone: String(r.profile && r.profile.phone || '').trim().slice(0, 40),
      email: String(r.profile && r.profile.email || '').trim().slice(0, 120)
    },
    photos: cleanPhotos(r.photos)
  };
}

export function createPrefs(files) {
  let cache = null;
  return {
    async load() {
      let parsed = null;
      try { const text = await files.read(); parsed = text ? JSON.parse(text) : null; } catch (e) { parsed = null; }   // a missing or damaged file means the defaults
      cache = cleanPrefs(parsed);
      return cache;
    },
    get() { return cache || cleanPrefs(null); },
    async set(patch) {
      cache = cleanPrefs({ ...(cache || {}), ...patch });
      try { await files.write(JSON.stringify(cache)); } catch (e) { /* the choice still holds until the app closes */ }
      return cache;
    }
  };
}
