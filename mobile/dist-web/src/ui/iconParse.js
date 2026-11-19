/* Turns one of the prototype's icon strings into a list of shapes the phone can draw (no React, so it is tested).
   A string that does not start with "<" is one path. Otherwise it is a few <rect>, <circle> and <path> tags. */
import { ICON_PATHS } from './iconPaths.js';

const NUMERIC = ['x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r'];

export function parseIcon(name) {
  const src = ICON_PATHS[name];
  if (!src) return [];
  if (src[0] !== '<') return [{ tag: 'path', props: { d: src } }];
  const shapes = [];
  for (const m of src.matchAll(/<(rect|circle|path)\b([^>]*?)\/?>/g)) {
    const props = {};
    for (const a of m[2].matchAll(/([a-z]+)="([^"]*)"/g)) props[a[1]] = NUMERIC.includes(a[1]) ? Number(a[2]) : a[2];
    shapes.push({ tag: m[1], props });
  }
  return shapes;
}

export const ICON_NAMES = Object.keys(ICON_PATHS);
