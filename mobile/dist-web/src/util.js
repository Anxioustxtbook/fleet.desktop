/* Small shared helpers: one error type with plain words, number rules that match the desktop, and a few tiny utilities. */

export const SEP = '\u0001';                        // joins list and id into one key (the desktop uses the same)
export const keyOf = (list, id) => list + SEP + String(id);

/* An error the app can show as it is. `code` is for the program, `message` is for the person. */
export class FpError extends Error {
  constructor(code, message, extra) {
    super(message);
    this.name = 'FpError';
    this.code = code;
    if (extra) this.extra = extra;
  }
}

export const num = v => Number(v) || 0;                                 // same rule as the desktop's totals
export const round2 = n => Math.round(n * 100) / 100;
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const iso = d => d.toISOString();                                // UTC with milliseconds
export const dayOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/* A short fingerprint of a text, to tell whether the set of changes of a half-finished sync is still the same. */
export function fingerprint(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}
