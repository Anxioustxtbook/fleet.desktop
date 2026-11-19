/* The splash's movement as plain numbers (no React, so it is tested): the diagonal reveal of the logo, the shine that
   sweeps across it, the wordmark rising, and the circle that opens the app at the end. Values are the prototype's. */

export const SPLASH = {
  minMs: 3150,          // the splash stays at least this long (the v5 prototype's setTimeout)
  logoWidth: 200,
  logoDelay: 180, logoMs: 1550,
  wordDelay: 1350, wordMs: 500,
  exitMs: 850,
  exitMaxRadius: 1200
};

const lerp = (a, b, k) => a + (b - a) * k;
const mix = (A, B, k) => A.map((p, i) => [lerp(p[0], B[i][0], k), lerp(p[1], B[i][1], k)]);

/* the prototype's cubic-bezier easing, solved for a time 0..1 */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t;
  return x => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 24; i++) { const d = X(t) - x; if (Math.abs(d) < 1e-6) break; if (d > 0) hi = t; else lo = t; t = (lo + hi) / 2; }
    return Y(t);
  };
}
export const easeLogo = bezier(0.2, 0.75, 0.25, 1);
export const easeExit = bezier(0.65, 0, 0.35, 1);

const P0 = [[0, 100], [0, 100], [0, 100], [0, 100]], P45 = [[0, 100], [100, 0], [100, 0], [0, 100]], P100 = [[0, 0], [100, 0], [100, 100], [0, 100]];

/* k = progress 0..1 of the logo animation: the clip polygon (percent of the logo) and its scale */
export function logoFrame(k) {
  const e = easeLogo(Math.max(0, Math.min(1, k)));
  return e <= 0.45
    ? { points: mix(P0, P45, e / 0.45), scale: lerp(0.94, 0.98, e / 0.45) }
    : { points: mix(P45, P100, (e - 0.45) / 0.55), scale: lerp(0.98, 1, (e - 0.45) / 0.55) };
}

const G0 = [[-35, 0], [-20, 0], [-40, 100], [-55, 100]], G1 = [[105, 0], [120, 0], [100, 100], [85, 100]];
export const shineFrame = k => mix(G0, G1, easeLogo(Math.max(0, Math.min(1, k))));

export const wordFrame = k => { const e = Math.max(0, Math.min(1, k)); return { opacity: e, rise: lerp(14, 0, e) }; };

/* the circle that grows from the bottom centre of the screen to open the app */
export const exitRadius = k => easeExit(Math.max(0, Math.min(1, k))) * SPLASH.exitMaxRadius;

export const polygonPoints = (pts, w, h) => pts.map(p => `${(p[0] * w / 100).toFixed(2)},${(p[1] * h / 100).toFixed(2)}`).join(' ');
