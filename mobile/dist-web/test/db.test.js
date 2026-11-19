/* Database and record tests. These need no desktop and always run. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpDir, makePlatform, nodeOpen } from './helpers.js';
import { openDatabase, ensureIdentity } from '../src/db/database.js';
import { createRecords } from '../src/db/records.js';
import { createReview } from '../src/review.js';
import { EPOCH } from '../src/config.js';
import { SEP } from '../src/util.js';

async function fresh({ dir = tmpDir(), clockMs } = {}) {
  let t = clockMs || Date.parse('2026-11-08T10:00:00.000Z');
  const platform = makePlatform(dir, { clock: () => new Date(t) });
  const db = await openDatabase(platform);
  const identity = await ensureIdentity(db, platform);
  const records = createRecords({ db, identity, now: platform.now });
  const review = createReview({ db, now: platform.now });
  return { dir, platform, db, identity, records, review, tick: ms => { t += ms; } };
}
const withRange = async (ctx, start = 1000000000, end = 1000999999) => { await ctx.db.setMeta('range', { start, end }); await ctx.db.setMeta('nextId', start); };
const rejectsWith = async (promise, code) => assert.rejects(promise, e => { assert.equal(e.code, code, `expected ${code}, got ${e.code}: ${e.message}`); return true; });

test('opens, builds its tables, uses the safest write setting, and keeps its identity', async () => {
  const ctx = await fresh();
  const tables = (await ctx.db.read(q => q.all(`SELECT name FROM sqlite_master WHERE type = 'table'`))).map(r => r.name);
  for (const t of ['meta', 'records', 'tombstones', 'arrivals', 'review']) assert.ok(tables.includes(t), t);
  assert.equal((await ctx.db.read(q => q.first('PRAGMA synchronous'))).synchronous, 2);        // 2 = FULL
  assert.match(ctx.identity.phoneId, /^P[A-Za-z0-9_-]{6,}$/);
  await ctx.db.close();
  const again = await fresh({ dir: ctx.dir });                                                  // same folder = same file
  assert.equal(again.identity.phoneId, ctx.identity.phoneId);
  assert.equal(again.identity.instance, ctx.identity.instance);
});

test('refuses a database made by a newer app and leaves it untouched', async () => {
  const dir = tmpDir(), file = path.join(dir, 'fleetpilot-mobile.db');
  const raw = nodeOpen(file); await raw.execAsync('PRAGMA user_version = 99'); await raw.closeAsync();
  const before = fs.readFileSync(file);
  await rejectsWith(openDatabase(makePlatform(dir)), 'too-new');
  assert.ok(before.equals(fs.readFileSync(file)));
});

test('refuses a damaged file and never changes or replaces it', async () => {
  const dir = tmpDir(), file = path.join(dir, 'fleetpilot-mobile.db');
  fs.writeFileSync(file, Buffer.alloc(4096, 7));
  const before = fs.readFileSync(file);
  await rejectsWith(openDatabase(makePlatform(dir)), 'damaged');
  assert.ok(before.equals(fs.readFileSync(file)));
});

test('record numbers come from the phone\'s own range; running out is reported', async () => {
  const ctx = await fresh();
  await withRange(ctx, 100, 101);
  assert.equal((await ctx.records.create('vehicles', { reg: 'A' })).id, 100);
  assert.equal((await ctx.records.create('vehicles', { reg: 'B' })).id, 101);
  await rejectsWith(ctx.records.create('vehicles', { reg: 'C' }), 'range-full');
  assert.equal((await ctx.records.all('vehicles')).length, 2);
});

test('twenty writes at once run one after another: no clashes, no gaps', async () => {
  const ctx = await fresh(); await withRange(ctx);
  const made = await Promise.all(Array.from({ length: 20 }, (_, i) => ctx.records.create('expenses', { amount: i })));
  const ids = made.map(r => r.id).sort((a, b) => a - b);
  assert.deepEqual(ids, Array.from({ length: 20 }, (_, i) => 1000000000 + i));
});

test('create, edit and delete are tracked, and only unsent changes are offered, parents first', async () => {
  const ctx = await fresh(); await withRange(ctx);
  const car = await ctx.records.create('vehicles', { reg: 'KAA 001A' });
  const rent = await ctx.records.create('rentals', { vehicleId: car.id, amount: 500 });
  const old = await ctx.records.create('expenses', { amount: 10 });

  let c = await ctx.records.localChanges();
  assert.deepEqual(c.changes.map(x => x.list), ['vehicles', 'rentals', 'expenses']);           // parents first
  assert.ok(c.changes.every(x => x.dev === ctx.identity.phoneId && x.at === '2026-11-08T10:00:00.000Z' && !x.deleted));
  assert.equal(c.changes[0].data.id, car.id);

  await ctx.records.markPushed(c.seq);
  assert.equal((await ctx.records.localChanges()).changes.length, 0);

  ctx.tick(1000);
  await ctx.records.update('rentals', rent.id, { amount: 900 });
  await ctx.records.remove('expenses', old.id);
  c = await ctx.records.localChanges();
  assert.equal(c.changes.length, 2);
  assert.equal(c.changes[0].data.amount, 900);                                                  // the whole record is sent
  assert.equal(c.changes[0].data.vehicleId, car.id);
  assert.deepEqual([c.changes[1].list, c.changes[1].id, c.changes[1].deleted], ['expenses', old.id, true]);   // deletes last
  assert.equal(typeof c.changes[1].id, 'number');
  assert.equal(await ctx.records.get('expenses', old.id), null);
});

test('a write that reads back differently is rolled back completely, counter included', async () => {
  const ctx = await fresh(); await withRange(ctx);
  await ctx.db.write(q => q.exec(`CREATE TRIGGER spoil AFTER INSERT ON records BEGIN UPDATE records SET data = '{"id":0}' WHERE list = NEW.list AND id = NEW.id; END`));
  await rejectsWith(ctx.records.create('vehicles', { reg: 'A' }), 'readback');
  assert.equal((await ctx.records.all('vehicles')).length, 0);
  await ctx.db.write(q => q.exec('DROP TRIGGER spoil'));
  assert.equal((await ctx.records.create('vehicles', { reg: 'A' })).id, 1000000000);            // the number was not used up
});

test('a full phone storage is reported in plain words and changes nothing', async () => {
  const ctx = await fresh(); await withRange(ctx);
  await ctx.records.create('vehicles', { reg: 'A' });
  const pages = (await ctx.db.read(q => q.first('PRAGMA page_count'))).page_count;
  await ctx.db.read(q => q.exec(`PRAGMA max_page_count = ${pages + 3}`));
  await assert.rejects(ctx.records.create('vehicles', { reg: 'B', note: 'x'.repeat(400000) }), e => {
    assert.equal(e.code, 'storage-full');
    assert.match(e.message, /storage is full/i);
    return true;
  });
  assert.equal((await ctx.records.all('vehicles')).length, 1);
  await ctx.db.read(q => q.exec('PRAGMA max_page_count = 1073741823'));
  assert.equal((await ctx.records.create('vehicles', { reg: 'C' })).id, 1000000001);
});

test('pulled changes: new records get a green dot that goes the next day', async () => {
  const ctx = await fresh();
  const out = await ctx.records.applyPulled([
    { list: 'rentals', id: 7, deleted: false, at: '2026-11-08T09:00:00.000Z', dev: 'D', data: { id: 7, vehicleId: 1, amount: 100 } },
    { list: 'vehicles', id: 1, deleted: false, at: '2026-11-08T09:00:00.000Z', dev: 'D', data: { id: 1, reg: 'KAA' } }
  ]);
  assert.equal(out.upserted, 2);
  assert.ok((await ctx.records.newToday()).has('rentals' + SEP + '7'));
  assert.equal((await ctx.records.localChanges()).changes.length, 0);                           // not sent back
  ctx.tick(24 * 3600 * 1000);
  await ctx.records.clearOldArrivals();
  assert.equal((await ctx.records.newToday()).size, 0);
  assert.equal((await ctx.records.get('rentals', 7)).amount, 100);                              // the record itself is untouched
});

test('the first full copy gets no green dots and very old times', async () => {
  const ctx = await fresh();
  assert.equal(await ctx.records.applyFullPage('vehicles', [{ id: 1, reg: 'A' }, { id: 2, reg: 'B' }]), 2);
  assert.equal((await ctx.records.newToday()).size, 0);
  const row = await ctx.db.read(q => q.first(`SELECT at, seq FROM records WHERE id = '1'`));
  assert.deepEqual([row.at, row.seq], [EPOCH, 0]);
});

test('a delete stays a delete unless the owner chose Restore', async () => {
  const ctx = await fresh();
  await ctx.records.applyFullPage('vehicles', [{ id: 1, reg: 'A' }]);
  await ctx.records.applyPulled([{ list: 'vehicles', id: 1, deleted: true, at: '2026-11-08T11:00:00.000Z', dev: 'D' }]);
  assert.equal(await ctx.records.get('vehicles', 1), null);
  const stale = await ctx.records.applyPulled([{ list: 'vehicles', id: 1, deleted: false, at: '2026-11-08T08:00:00.000Z', dev: 'D', data: { id: 1, reg: 'OLD' } }]);
  assert.equal(stale.ignored, 1);
  assert.equal(await ctx.records.get('vehicles', 1), null);
  await ctx.records.applyPulled([{ list: 'vehicles', id: 1, deleted: false, at: '2026-11-08T12:00:00.000Z', dev: 'D', restore: true, data: { id: 1, reg: 'BACK' } }]);
  assert.equal((await ctx.records.get('vehicles', 1)).reg, 'BACK');
});

test('an edit made on the phone during a sync is kept, not overwritten by what was pulled', async () => {
  const ctx = await fresh(); await withRange(ctx);
  const car = await ctx.records.create('vehicles', { reg: 'MINE' });                            // not sent yet
  const out = await ctx.records.applyPulled([{ list: 'vehicles', id: car.id, deleted: false, at: '2026-11-08T12:00:00.000Z', dev: 'D', data: { id: car.id, reg: 'THEIRS' } }]);
  assert.equal(out.keptLocal, 1);
  assert.equal((await ctx.records.get('vehicles', car.id)).reg, 'MINE');
  assert.equal((await ctx.records.localChanges()).changes.length, 1);                           // and it still goes up next time
});

test('a change that lost against the computer is kept in the review list', async () => {
  const ctx = await fresh(); await withRange(ctx);
  const car = await ctx.records.create('vehicles', { reg: 'MINE' });
  const sent = await ctx.records.localChanges();
  await ctx.records.markPushed(sent.seq);
  const out = await ctx.records.applyPulled(
    [{ list: 'vehicles', id: car.id, deleted: false, at: '2026-11-08T12:00:00.000Z', dev: 'D', data: { id: car.id, reg: 'THEIRS' } }],
    { pushedBefore: 0 });
  assert.equal(out.replaced, 1);
  assert.equal((await ctx.records.get('vehicles', car.id)).reg, 'THEIRS');
  const items = await ctx.review.open();
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'replaced');
  assert.equal(items[0].payload.yours.reg, 'MINE');
});

test('totals use the computer\'s rule: count, and the sum of "amount" rounded to 2 decimals', async () => {
  const ctx = await fresh();
  await ctx.records.applyFullPage('payments', [{ id: 1, amount: 10.105 }, { id: 2, amount: '20.2' }, { id: 3, amount: 'abc' }, { id: 4 }]);
  const t = await ctx.records.totals();
  assert.deepEqual(t.payments, { n: 4, sum: 30.31 });
  assert.deepEqual(t.vehicles, { n: 0, sum: 0 });
});

test('held items open for what the computer holds and close by themselves when it no longer does', async () => {
  const ctx = await fresh();
  await ctx.review.syncHeld(['rentals' + SEP + '5', 'payments' + SEP + '9']);
  assert.equal((await ctx.review.open()).length, 2);
  await ctx.review.syncHeld(['rentals' + SEP + '5', 'payments' + SEP + '9']);                    // same again: no duplicates
  assert.equal((await ctx.review.open()).length, 2);
  await ctx.review.syncHeld(['rentals' + SEP + '5']);
  assert.deepEqual((await ctx.review.open()).map(i => i.recId), ['5']);
  assert.equal(await ctx.review.count(), 1);
});

/* ---------- developer backup ---------- */
import { createDevBackup } from '../src/backup.js';

async function withBackup() {
  const ctx = await fresh(); await withRange(ctx);
  await ctx.records.applyFullPage('vehicles', [{ id: 1, reg: 'A' }, { id: 2, reg: 'B' }]);
  await ctx.records.create('expenses', { amount: 25 });
  const backup = createDevBackup({ db: ctx.db, identity: ctx.identity, platform: ctx.platform, now: ctx.platform.now });
  const dir = await ctx.platform.fs.backupFolder();
  const files = { db: path.join(dir, 'FleetPilot Mobile - developer.db'), json: path.join(dir, 'FleetPilot Mobile - developer.json'), log: path.join(dir, 'backup-log.txt') };
  return { ...ctx, backup, files, dir };
}

test('developer backup: a .db and a .json side by side, both checked, and not due again until 14 days pass', async () => {
  const ctx = await withBackup();
  assert.equal(await ctx.backup.dueNow(), true);
  const r = await ctx.backup.refreshIfDue();
  assert.deepEqual([r.ran, r.ok], [true, true]);

  const copy = nodeOpen(ctx.files.db);                                                          // it opens as a normal database
  assert.equal((await copy.getFirstAsync('SELECT COUNT(*) AS n FROM records')).n, 3);
  assert.equal(Object.values(await copy.getFirstAsync('PRAGMA integrity_check'))[0], 'ok');
  await copy.closeAsync();

  const json = JSON.parse(fs.readFileSync(ctx.files.json, 'utf8'));
  assert.equal(json.kind, 'developer-backup');
  assert.equal(json.device, ctx.identity.phoneId);
  assert.deepEqual(json.counts, { vehicles: 2, expenses: 1 });
  assert.deepEqual(json.data.vehicles.map(v => v.reg), ['A', 'B']);
  assert.deepEqual(json.data.payments, []);
  assert.match(fs.readFileSync(ctx.files.log, 'utf8'), /ok: 3 records/);
  assert.deepEqual(fs.readdirSync(ctx.dir).sort(), ['FleetPilot Mobile - developer.db', 'FleetPilot Mobile - developer.json', 'backup-log.txt']);   // no stray files

  assert.equal((await ctx.backup.refreshIfDue()).ran, false);                                   // not due yet
  ctx.tick(15 * 24 * 3600 * 1000);
  assert.equal(await ctx.backup.dueNow(), true);                                                // 15 days later
});

test('developer backup: a missing file is made again at once, in place', async () => {
  const ctx = await withBackup();
  await ctx.backup.refreshIfDue();
  fs.rmSync(ctx.files.json);
  assert.equal(await ctx.backup.dueNow(), true);
  assert.equal((await ctx.backup.refreshIfDue()).ok, true);
  assert.ok(fs.existsSync(ctx.files.json));
});

test('developer backup: a refresh that fails keeps the last good pair and says why in the log', async () => {
  const ctx = await withBackup();
  await ctx.backup.refreshIfDue();
  const before = { db: fs.readFileSync(ctx.files.db), json: fs.readFileSync(ctx.files.json) };

  await ctx.records.create('expenses', { amount: 99 });
  const realWrite = ctx.platform.fs.write;
  ctx.platform.fs.write = async () => { throw new Error('the storage refused the file'); };
  const r = await ctx.backup.refresh();
  ctx.platform.fs.write = realWrite;

  assert.equal(r.ok, false);
  assert.ok(before.db.equals(fs.readFileSync(ctx.files.db)) && before.json.equals(fs.readFileSync(ctx.files.json)), 'the older pair must be untouched');
  assert.deepEqual(fs.readdirSync(ctx.dir).sort(), ['FleetPilot Mobile - developer.db', 'FleetPilot Mobile - developer.json', 'backup-log.txt']);   // temporary files removed
  assert.match(fs.readFileSync(ctx.files.log, 'utf8'), /failed: the storage refused the file \(the older backup was kept\)/);
  assert.equal((await ctx.records.all('expenses')).length, 2);                                  // the app itself is unaffected
  assert.equal((await ctx.backup.refresh()).ok, true);                                          // and the next try works
});

/* ---------- entering records before the phone is paired ---------- */
test('before pairing, records get temporary numbers; pairing swaps them for real ones and every link follows', async () => {
  const ctx = await fresh();
  const car = await ctx.records.create('vehicles', { reg: 'KDA 1A' });
  const [client, rental] = await ctx.records.saveBatch([
    { op: 'create', list: 'clients', fields: { name: 'Wanjiku' } },
    { op: 'create', list: 'rentals', fields: r => ({ vehicleId: car.id, clientId: r[0].id, amount: 9000 }) }
  ]);
  const pay = await ctx.records.create('payments', { rentalId: rental.id, amount: 4000 });
  assert.ok([car, client, rental, pay].every(x => x.id >= 9_000_000_000_000));
  assert.equal(new Set([car.id, client.id, rental.id, pay.id]).size, 4);

  await withRange(ctx, 500, 600);
  assert.equal(await ctx.records.adoptRange(), 4);
  const [v] = await ctx.records.all('vehicles'), [c] = await ctx.records.all('clients'), [r] = await ctx.records.all('rentals'), [p] = await ctx.records.all('payments');
  assert.deepEqual([v.id, c.id, r.id, p.id], [500, 501, 502, 503]);          // in the order they were entered
  assert.equal(r.vehicleId, 500); assert.equal(r.clientId, 501); assert.equal(p.rentalId, 502);
  assert.equal((await ctx.records.localChanges({ all: false })).changes.length, 4);   // all four are waiting to be sent
  assert.equal(await ctx.records.adoptRange(), 0);                            // nothing left to do the second time
  assert.equal((await ctx.records.create('vehicles', { reg: 'B' })).id, 504);
});

test('a record made and deleted before pairing leaves nothing behind, and a failed renumbering changes nothing', async () => {
  const ctx = await fresh();
  const gone = await ctx.records.create('vehicles', { reg: 'GONE' });
  const keep = await ctx.records.create('vehicles', { reg: 'KEEP' });
  await ctx.records.remove('vehicles', gone.id);
  await withRange(ctx, 10, 10);                                               // room for one number only: the renumbering needs one for KEEP
  assert.equal(await ctx.records.adoptRange(), 1);
  assert.equal((await ctx.records.all('vehicles')).map(v => v.id).join(), '10');
  const ch = await ctx.records.localChanges({ all: false });
  assert.ok(!ch.changes.some(x => x.deleted));

  const small = await fresh();
  await small.records.create('vehicles', { reg: 'A' }); await small.records.create('vehicles', { reg: 'B' });
  await withRange(small, 10, 10);                                             // two records, one number
  await rejectsWith(small.records.adoptRange(), 'range-full');
  const left = await small.records.all('vehicles');
  assert.equal(left.length, 2); assert.ok(left.every(v => v.id >= 9_000_000_000_000));
});
