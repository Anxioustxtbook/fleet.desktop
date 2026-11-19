/* Bugs found in the code review, each with the test that would have caught it. */
process.env.TZ = 'Africa/Nairobi';                       // the owner's time zone: UTC+3, so local and UTC dates differ for 3 hours every night
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpDir, makePlatform } from './helpers.js';
import { openDatabase, ensureIdentity } from '../src/db/database.js';
import { createRecords } from '../src/db/records.js';
import { createReview } from '../src/review.js';
import { createEngine } from '../src/sync/engine.js';
import { FpError } from '../src/util.js';
import { planSave, valuesFromRecord } from '../src/ui/forms.js';
import { monthRange } from '../src/ui/overview.js';
import { todayISO } from '../src/shared/subhireCore.js';

/* ---- 1. "this month" and "today" must follow the phone's clock, not UTC ---- */
test('just after midnight on the 1st (Nairobi), the month and the day are the new ones', () => {
  const midnightPast = new Date(2026, 11, 1, 0, 30);          // 1 Dec 00:30 local = 30 Nov 21:30 UTC
  assert.equal(midnightPast.toISOString().slice(0, 7), '2026-11');   // what the old code used
  const rg = monthRange({ rentals: [{ pickup: '2026-11-05' }] }, midnightPast);
  assert.equal(rg[1], '2026-12');
});
test('the shared todayISO is the local day', () => {
  const real = Date; const fixed = new real(2026, 11, 1, 0, 30);
  global.Date = class extends real { constructor(...a) { return a.length ? new real(...a) : new real(fixed.getTime()); } static now() { return fixed.getTime(); } };
  try { assert.equal(todayISO(), '2026-12-01'); } finally { global.Date = real; }
});

/* ---- 2. a first copy that was cut off carries on; it is not treated as a merge, and its totals are still checked ---- */
test('a cut-off first copy resumes without the merge question and still reports differing totals', async () => {
  const platform = makePlatform(tmpDir()), db = await openDatabase(platform), identity = await ensureIdentity(db, platform), now = platform.now;
  const records = createRecords({ db, identity, now }), review = createReview({ db, now });
  let pageCalls = 0, cutOff = true;
  const client = { post: async (addr, path) => {
    if (path === '/fp/full/begin') return { counts: { vehicles: 2 }, snapshotSeq: 7 };
    if (path === '/fp/full/page') { pageCalls++; if (pageCalls === 1) return { list: 'vehicles', records: [{ id: 1, reg: 'A' }], done: false, next: { li: 0, off: 1 } };
      if (cutOff) { cutOff = false; throw new FpError('unreachable', 'Wi-Fi dropped'); }
      return { list: 'vehicles', records: [{ id: 1, reg: 'A' }, { id: 2, reg: 'B' }], done: true, next: null }; }
    if (path === '/fp/full/done') return { totalsOk: false, diff: { vehicles: { phone: 2, computer: 3 } } };
    throw new Error('unexpected ' + path);
  } };
  const pairing = { link: async () => ({ desktop: {}, auth: {} }), reach: async () => 'x' };
  await db.setMeta('needsFullCopy', true);
  const engine = createEngine({ db, records, review, client, pairing, identity, platform, now });

  await assert.rejects(() => engine.fullCopy(), e => e.code === 'unreachable');          // cut off after the first page
  assert.equal(await db.getMeta('needsFullCopy'), true);
  const done = await engine.fullCopy();                                                   // before the fix: "not-empty"
  assert.equal(done.ok, true);
  assert.equal(await db.getMeta('needsFullCopy'), false); assert.equal(await db.getMeta('copyStarted'), false);
  assert.equal((await review.open()).filter(r => r.kind === 'totals').length, 1);         // before the fix: silently dropped
});

/* ---- 3. a car is not "Rented" for ever ---- */
const base = () => ({
  vehicles: [{ id: 1, reg: 'KAA 001A', rate: 5000, ownership: 'own', status: 'Rented' }, { id: 2, reg: 'KBB 002B', rate: 6000, ownership: 'own', status: 'Available' }],
  clients: [{ id: 3, name: 'ACME', type: 'coop' }], drivers: [], bookings: [], coops: [], invoices: [], insurance: [], fuelAccount: [], payments: [], expenses: [],
  rentals: [{ id: 4, vehicleId: 1, clientId: 3, pickup: '2026-11-01', return: '2026-11-03', amount: 10000, days: 2, status: 'Active' }]
});
const plan = (d, existing, change) => {
  const c = { data: d, today: '2026-11-10', existing, preset: null };
  const values = { ...valuesFromRecord('rentals', existing, c), ...change };
  return planSave('rentals', values, c).ops;
};
const vehicleOps = ops => ops.filter(o => o.list === 'vehicles').map(o => `${o.id}:${o.patch.status}`);
test('completing or cancelling the only active rental frees the car', () => {
  const d = base();
  assert.deepEqual(vehicleOps(plan(d, d.rentals[0], { status: 'Completed' })), ['1:Available']);
  assert.deepEqual(vehicleOps(plan(d, d.rentals[0], { status: 'Cancelled' })), ['1:Available']);
});
test('the car stays Rented while another rental of it is still Active', () => {
  const d = base(); d.rentals.push({ id: 9, vehicleId: 1, clientId: 3, pickup: '2026-11-05', return: '2026-11-06', amount: 5000, days: 1, status: 'Active' });
  assert.deepEqual(vehicleOps(plan(d, d.rentals[0], { status: 'Completed' })), []);
});
test('moving an active rental to another car frees the first and rents the second', () => {
  const d = base();
  assert.deepEqual(vehicleOps(plan(d, d.rentals[0], { vehicleId: 2 })).sort(), ['1:Available', '2:Rented']);
});
test('a car in Maintenance or Inactive is never changed by a rental', () => {
  const d = base(); d.vehicles[0].status = 'Maintenance';
  assert.deepEqual(vehicleOps(plan(d, d.rentals[0], { status: 'Completed' })), []);
});

/* ---- 4. the video's lesson: catch SQL injection before it ships. Fails if anyone builds SQL by gluing text in (use ? and a list of values). ---- */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []));
test('no SQL in src/ is built by joining text; only the two reviewed constants are allowed', () => {
  const allowed = [/PRAGMA user_version = \$\{SCHEMA_VERSION\}/, /VACUUM INTO '\$\{String\(plainPath\)\.replace\(\/'\/g, "''"\)\}'/];   // a constant, and a path that is quote-escaped
  const bad = [];
  for (const file of walk(fileURLToPath(new URL('../src', import.meta.url)))) {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      const sql = /\b(SELECT|INSERT|UPDATE|DELETE|PRAGMA|VACUUM|CREATE|DROP|ALTER)\b/.test(line);
      const glued = /\$\{[^}]*\}/.test(line) || /['"`]\s*\+\s*[a-zA-Z_]/.test(line);
      if (sql && glued && /\b(q|raw|db)\.(exec|run|all|first)|execAsync|runAsync|getAllAsync|getFirstAsync|`(SELECT|INSERT|UPDATE|DELETE|PRAGMA|VACUUM)/.test(line) && !allowed.some(a => a.test(line))) bad.push(`${path.relative(process.cwd(), file)}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, []);
});
