/* Pictures stay on this phone only (UI_SPEC 5.2 "Photos"): chosen with the phone's picker, shrunk (long side 720, JPEG 0.8), saved in the app's own
   folder, and remembered in the phone-only settings file. Nothing here goes into a record, a sync or the developer backup.
   The key is `list|id` (a vehicle's picture, a client's, ...) or 'dashboard'. The native pieces are loaded only when a picture is chosen. */
export const photoKey = (list, id) => `${list}|${id}`;
export const MAX_SIDE = 720, JPEG_QUALITY = 0.8;

/* the size a picture is shrunk to: the long side is 720, never enlarged */
export function fitSize(w, h, max = MAX_SIDE) {
  const W = Number(w) || 0, H = Number(h) || 0;
  if (!W || !H || Math.max(W, H) <= max) return { width: W, height: H, resize: false };
  const k = max / Math.max(W, H);
  return { width: Math.round(W * k), height: Math.round(H * k), resize: true };
}
export const cleanPhotos = raw => {
  const out = {}; if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw)) if (typeof v === 'string' && v) out[String(k)] = v;
  return out;
};

/* opens the picker; resolves to the saved file's uri, or null when cancelled or refused */
export async function pickPhoto(key) {
  const Picker = await import('expo-image-picker');
  const Manip = await import('expo-image-manipulator');
  const FS = await import('expo-file-system');
  const perm = await Picker.requestMediaLibraryPermissionsAsync();
  if (perm && perm.granted === false) return { ok: false, reason: 'denied' };
  const got = await Picker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
  if (got.canceled || !got.assets || !got.assets[0]) return null;
  const a = got.assets[0], fit = fitSize(a.width, a.height);
  const out = await Manip.manipulateAsync(a.uri, fit.resize ? [{ resize: fit.width >= fit.height ? { width: fit.width } : { height: fit.height } }] : [], { compress: JPEG_QUALITY, format: Manip.SaveFormat.JPEG });
  const dir = `${FS.documentDirectory}photos/`;
  try { await FS.makeDirectoryAsync(dir, { intermediates: true }); } catch (e) { /* it exists */ }
  const to = `${dir}${key.replace(/[^a-z0-9]+/gi, '_')}_${Date.now()}.jpg`;
  await FS.copyAsync({ from: out.uri, to });
  return { ok: true, uri: to };
}
export async function deletePhotoFile(uri) {
  try { const FS = await import('expo-file-system'); await FS.deleteAsync(uri, { idempotent: true }); } catch (e) { /* already gone */ }
}
