/* Display size, with no React in it so it can be tested.
   The prototype's "Display size" (--z) makes everything smaller or larger. It runs from 0.60 to 1.00 in steps of
   0.02, the default is 0.80, and a saved 0.70 (an older default) is read as 0.80, exactly as the prototype does. */
export const DEFAULT_Z = 0.8;
export const MIN_Z = 0.6;
export const MAX_Z = 1;
export const STEP_Z = 0.02;

export function normalizeZ(value) {
  if (value === null || value === undefined || value === '') return DEFAULT_Z;
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return DEFAULT_Z;
  if (Math.abs(n - 0.7) < 1e-9) return DEFAULT_Z;
  return clampZ(n);
}

export function clampZ(n) {
  const stepped = Math.round(Number(n) / STEP_Z) * STEP_Z;
  return Math.round(Math.min(MAX_Z, Math.max(MIN_Z, stepped)) * 100) / 100;
}

/* a size from the prototype (in CSS pixels) as it is drawn at display size z */
export const scaled = (n, z = DEFAULT_Z) => Math.round(n * z * 100) / 100;
export const zText = z => Number(z).toFixed(2);

/* The newest prototype: tap targets are at least 48 on the screen at any display size (the size is NOT shrunk with the
   display size). tapSize(44, 0.8) gives 48; tapSize(60, 0.8) gives 48 too (60 x 0.8), and it grows only when the scaled size is bigger. */
export const MIN_TAP = 48;
export const tapSize = (n, z = DEFAULT_Z) => Math.max(MIN_TAP, scaled(n, z));
