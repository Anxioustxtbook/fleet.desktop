/* The phone app talking to the REAL desktop sync server and SQLite store (not a copy of its rules).
   Run with:  FP_DESKTOP=/path/to/the/desktop/project  npm test      (skipped when FP_DESKTOP is not set) */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DESKTOP, desktopKit, desktopModule, makePlatform, tmpDir } from './helpers.js';
import { createApp } from '../src/app.js';
import { sleep } from '../src/util.js';
import { restoreMine } from '../src/review.js';
import { buildPatch } from '../src/ui/logic.js';

const skip = DESKTOP ? false : 'set FP_DESKTOP to the desktop project folder to run the tests against the real desktop';
const D = DESKTOP ? desktopKit() : null;
const rejectsWith = async (promise, code) => assert.rejects(promise, e => { assert.equal(e.code, code, `expected ${code}, got ${e.code}: ${e.message}`); return true; });

/* ---------- scaffolding ---------- */
async function newPhone(env, { skew = 0, fetchFn, secure = new Map(), dir = tmpDir(), protocol } = {}) {
  const clk = { skew };
  const platform = makePlatform(dir, { clock: () => new Date(env.now() + clk.skew), fetchFn, secure, protocol, discoveryPort: env.discoveryPort });
  const app = await createApp(platform);
  return { app, platform, clk, secure, dir, records: app.records, db: app.db };
}

/* pair, and approve on the "computer" as soon as it lists the waiting phone */
async function pairPhone(env, phone, { pin, choice } = {}) {
  const pairing = phone.app.pairing.pair({ addresses: [env.url.replace('http://', '')], pin: pin == null ? env.sync.status().pin : pin, desktopId: env.store.deviceId });
  pairing.catch(() => {});                                      // a refused pairing is reported to the caller below, not as a stray error
  for (let i = 0; i < 300; i++) {
    const waiting = env.sync.status().pending;
    if (waiting.length) { const r = await env.sync.approve(waiting[0].id, choice); assert.ok(r.ok, JSON.stringify(r)); break; }
    if (await Promise.race([pairing.then(() => true, () => true), sleep(10).then(() => false)])) break;
  }
  return pairing;
}
async function ready(env, phone, options) {                          // paired and holding the first full copy
  await pairPhone(env, phone, options);
  const copy = await phone.app.engine.fullCopy();
  assert.ok(copy.ok && copy.totalsOk, JSON.stringify(copy));
}
async function desktopData(env) { const l = await env.store.load('Main'); assert.ok(l.ok); return l.data; }
async function desktopEdit(env, fn) {
  const data = await desktopData(env); fn(data);
  const r = await env.store.save('Main', data); assert.ok(r.ok, JSON.stringify(r));
}
const ids = list => list.map(r => r.id).sort((a, b) => a - b);
const sameLists = async (env, phone) => {                           // both sides hold the same records
  const d = await desktopData(env);
  for (const list of D.LIST_KEYS) assert.deepEqual(ids(await phone.records.all(list)), ids(d[list] || []), `list ${list}`);
};
const withEnv = fn => async () => { const env = await D.setup(); try { await fn(env); } finally { await env.close(); } };

/* ---------- pairing ---------- */
test('pairing: a wrong PIN says try again, the right PIN waits for approval, and the key stays out of the database', { skip }, withEnv(async env => {
  const phone = await newPhone(env);
  await assert.rejects(pairPhone(env, phone, { pin: '000000' }), e => { assert.equal(e.code, 'bad-pin'); assert.equal(e.extra.tryAgain, true); return true; });
  assert.equal(await phone.db.getMeta('desktop'), null);

  await pairPhone(env, phone);
  const status = await phone.app.status();
  assert.equal(status.paired, true);
  assert.equal(status.needsFullCopy, true);
  assert.ok(status.range.start >= 1000000000);

  const token = await phone.secure.get('fp.token');
  assert.match(token, /^[0-9a-f]{48}$/);
  const everything = JSON.stringify(await phone.db.read(q => q.all('SELECT * FROM meta')));
  assert.ok(!everything.includes(token), 'the key must never be in the database (it would be in backups)');
  assert.equal(env.sync.barStatus().paired, 1);
}));

test('pairing: typed addresses that belong to a different computer are refused', { skip }, withEnv(async env => {
  const phone = await newPhone(env);
  await rejectsWith(phone.app.pairing.pair({ addresses: [env.url.replace('http://', '')], pin: env.sync.status().pin, desktopId: 'someone-else' }), 'wrong-desktop');
}));

test('pairing: an owner who rejects gets a plain message', { skip }, withEnv(async env => {
  const phone = await newPhone(env);
  const pairing = phone.app.pairing.pair({ addresses: [env.url.replace('http://', '')], pin: env.sync.status().pin, desktopId: env.store.deviceId });
  for (let i = 0; i < 300 && !env.sync.status().pending.length; i++) await sleep(10);
  await env.sync.reject(env.sync.status().pending[0].id);
  await rejectsWith(pairing, 'rejected');
}));

/* ---------- the first full copy ---------- */
test('first full copy: everything arrives, no green dots, totals agree, and a second copy needs a deliberate choice', { skip }, withEnv(async env => {
  const phone = await newPhone(env);
  await rejectsWith(phone.app.engine.syncNow(), 'not-paired');
  await pairPhone(env, phone);
  await rejectsWith(phone.app.engine.syncNow(), 'needs-full-copy');

  const progress = [];
  const copy = await phone.app.engine.fullCopy({ onProgress: p => progress.push(p) });
  assert.equal(copy.ok, true); assert.equal(copy.totalsOk, true);
  assert.equal(copy.copied, 5);
  assert.ok(progress.length && progress[progress.length - 1].done === 5 && progress[0].total === 5);
  await sameLists(env, phone);
  assert.equal((await phone.records.newToday()).size, 0);
  assert.equal((await phone.app.status()).needsFullCopy, false);
  assert.equal((await phone.records.localChanges()).changes.length, 0);          // nothing to send back

  await rejectsWith(phone.app.engine.fullCopy(), 'not-empty');
  assert.equal((await phone.app.engine.fullCopy({ merge: true })).ok, true);
  assert.equal(phone.platform.awake.on, phone.platform.awake.off);               // the phone was allowed to sleep again
}));

/* ---------- ordinary syncing ---------- */
test('sync: what the phone adds reaches the computer, with record numbers from the phone\'s own range', { skip }, withEnv(async env => {
  const phone = await newPhone(env); await ready(env, phone);
  const start = (await phone.db.getMeta('range')).start;
  env.tick(60000);
  const client = await phone.records.create('clients', { name: 'Phone Client' });
  const rental = await phone.records.create('rentals', { vehicleId: 1, clientId: client.id, amount: 800, status: 'Active' });
  const payment = await phone.records.create('payments', { rentalId: rental.id, amount: 300 });
  assert.ok([client.id, rental.id, payment.id].every(n => n >= start));

  const r = await phone.app.sync();
  assert.equal(r.ok, true); assert.equal(r.pushed, 3); assert.equal(r.totalsOk, true);
  assert.equal(r.summary.added, 3);
  const d = await desktopData(env);
  assert.ok(d.clients.some(c => c.id === client.id && c.name === 'Phone Client'));
  assert.ok(d.rentals.some(x => x.id === rental.id && x.vehicleId === 1));
  assert.ok(d.payments.some(x => x.id === payment.id && x.rentalId === rental.id));
  assert.equal(d.nextId <= 1000000000, true, 'the computer\'s own counter must not jump into the phone range');
  assert.equal(env.sync.reviewList().length, 0);

  const again = await phone.app.sync();                                          // nothing new: nothing sent
  assert.equal(again.pushed, 0);
  await sameLists(env, phone);
  assert.equal(phone.platform.awake.on, phone.platform.awake.off);
}));

test('sync: what the computer adds and changes reaches the phone, new records get a green dot', { skip }, withEnv(async env => {
  const phone = await newPhone(env); await ready(env, phone);
  env.tick(60000);
  await desktopEdit(env, d => {
    d.vehicles.push({ id: d.nextId, reg: 'KCC 003C' }); d.nextId++;
    d.rentals[0].amount = 6500;
  });
  const r = await phone.app.sync();
  assert.equal(r.pulled >= 2, true);
  assert.equal((await phone.records.get('rentals', 4)).amount, 6500);
  const added = (await phone.records.all('vehicles')).find(v => v.reg === 'KCC 003C');
  assert.ok(added);
  const dots = await phone.records.newToday();
  assert.ok(dots.size >= 2);
  await sameLists(env, phone);
  assert.equal(r.totalsOk, true);
}));

test('sync: both sides add and edit different records in one go, and end up identical', { skip }, withEnv(async env => {
  const phone = await newPhone(env); await ready(env, phone);
  env.tick(60000);
  await phone.records.update('vehicles', 1, { reg: 'KAA 001A (phone)' });
  await phone.records.create('expenses', { amount: 50, category: 'Fuel' });
  await desktopEdit(env, d => { d.clients[0].name = 'ACME Ltd'; d.expenses.push({ id: d.nextId, amount: 70 }); d.nextId++; });
  await phone.app.sync();
  const d = await desktopData(env);
  assert.equal(d.vehicles.find(v => v.id === 1).reg, 'KAA 001A (phone)');
  assert.equal((await phone.records.get('clients', 3)).name, 'ACME Ltd');
  assert.equal(d.expenses.length, 2);
  await sameLists(env, phone);
}));

test('conflict: the newer edit wins, the loser is kept on the computer, and the phone is told its change was replaced', { skip }, withEnv(async env => {
  const phone = await newPhone(env); await ready(env, phone);
  env.tick(60000);
  await phone.records.update('rentals', 4, { amount: 1111 });                    // phone edit at T1
  env.tick(60000);
  await desktopEdit(env, d => { d.rentals[0].amount = 2222; });                  // computer edit at T2 (newer)
  const r = await phone.app.sync();
  assert.equal(r.applied.replaced, 1);
  assert.equal((await phone.records.get('rentals', 4)).amount, 2222);
  assert.equal((await desktopData(env)).rentals[0].amount, 2222);
  assert.ok(env.sync.reviewList().some(i => i.kind === 'conflict'), 'the computer keeps the losing version for Restore');
  const mine = (await phone.app.review.open()).find(i => i.kind === 'replaced');
  assert.equal(mine.payload.yours.amount, 1111);
}));

test('conflict: when the phone edit is newer it wins, and nothing comes back over it', { skip }, withEnv(async env => {
  const phone = await newPhone(env); await ready(env, phone);
  env.tick(60000);
  await desktopEdit(env, d => { d.rentals[0].amount = 2222; });                  // computer edit at T1
  env.tick(60000);
  await phone.records.update('rentals', 4, { amount: 3333 });                    // phone edit at T2 (newer)
  const r = await phone.app.sync();
  assert.equal(r.applied.replaced, 0);
  assert.equal((await desktopData(env)).rentals[0].amount, 3333);
  assert.equal((await phone.records.get('rentals', 4)).amount, 3333);
  assert.equal((await phone.app.review.open()).filter(i => i.kind === 'replaced').length, 0);
}));

test('review list: "Restore my version" puts the phone\'s version back, and it wins at the next sync', { skip }, withEnv(async env => {
  const phone = await newPhone(env); await ready(env, phone);
  env.tick(60000);
  await phone.records.update('rentals', 4, { amount: 1111 });
  env.tick(60000);
  await desktopEdit(env, d => { d.rentals[0].amount = 2222; });
  await phone.app.sync();
  assert.equal((await phone.records.get('rentals', 4)).amount, 2222);
  const item = (await phone.app.review.open()).find(i => i.kind === 'replaced');

  env.tick(60000);
  await restoreMine({ records: phone.records, review: phone.app.review }, item);
  assert.equal((await phone.app.review.open()).length, 0);                       // the item is dealt with
  await phone.app.sync();
  assert.equal((await desktopData(env)).rentals[0].amount, 1111);
  assert.equal((await phone.records.get('rentals', 4)).amount, 1111);
  await sameLists(env, phone);
}));

test('review list: editing a held record to point at something that exists gets it applied, and the item closes', { skip }, withEnv(async env => {
  const phone = await newPhone(env); await ready(env, phone);
  env.tick(60000);
  const rental = await phone.records.create('rentals', { vehicleId: 999, clientId: 3, amount: 10 });
  await phone.app.sync();
  assert.equal((await desktopData(env)).rentals.some(x => x.id === rental.id), false);
  assert.equal((await phone.app.review.open()).filter(i => i.kind === 'held').length, 1);

  env.tick(60000);
  const { patch, errors } = buildPatch(await phone.records.get('rentals', rental.id), { vehicleId: '1' });   // what the editor does
  assert.deepEqual(errors, {});
  await phone.records.update('rentals', rental.id, patch);
  await phone.app.sync();
  const onDesktop = (await desktopData(env)).rentals.find(x => x.id === rental.id);
  assert.ok(onDesktop, 'the corrected record reached the live data');
  assert.equal(onDesktop.vehicleId, 1);
  assert.equal((await phone.app.review.open()).filter(i => i.kind === 'held').length, 0);
  await sameLists(env, phone);
}));

test('deleting: a delete on either side reaches the other, and stays a delete', { skip }, withEnv(async env => {
  const phone = await newPhone(env); await ready(env, phone);
  env.tick(60000);
  await phone.records.remove('payments', 5);
  await desktopEdit(env, d => { d.vehicles = d.vehicles.filter(v => v.id !== 2); });
  await phone.app.sync();
  assert.equal((await desktopData(env)).payments.length, 0);
  assert.equal(await phone.records.get('vehicles', 2), null);
  await phone.app.sync();                                                        // a second sync does not bring either back
  assert.equal(await phone.records.get('vehicles', 2), null);
  assert.equal((await desktopData(env)).payments.length, 0);
  await sameLists(env, phone);
}));

/* ---------- when things go wrong ---------- */
test('a connection that drops in the middle of sending carries on from the last finished batch, with nothing doubled', { skip }, withEnv(async env => {
  let pushes = 0, failAt = 2, armed = true;
  const fetchFn = async (url, init) => {
    if (String(url).endsWith('/fp/sync/push')) { pushes++; if (armed && pushes === failAt) { armed = false; throw new TypeError('network dropped'); } }
    return fetch(url, init);
  };
  const phone = await newPhone(env, { fetchFn }); await ready(env, phone);
  env.tick(60000);
  for (let i = 0; i < 450; i++) await phone.records.create('expenses', { amount: 1 });     // 3 batches of 200

  await rejectsWith(phone.app.sync(), 'unreachable');
  assert.equal((await phone.db.getMeta('session')).phase, 'pushing');
  assert.equal((await phone.records.localChanges()).changes.length, 450);                   // still marked as unsent

  pushes = 0;
  const r = await phone.app.sync();
  assert.equal(pushes, 2, 'the batch the computer already stored must not be sent again');
  assert.equal(r.pushed, 450);
  assert.equal((await desktopData(env)).expenses.length, 450);
  assert.equal(await phone.db.getMeta('session'), null);
  assert.equal((await phone.records.localChanges()).changes.length, 0);
  await sameLists(env, phone);
}));

test('a connection that drops after everything was sent: the next sync finishes without sending or applying anything twice', { skip }, withEnv(async env => {
  let armed = true;
  const fetchFn = async (url, init) => {
    if (armed && String(url).endsWith('/fp/sync/finish')) { armed = false; throw new TypeError('network dropped'); }
    return fetch(url, init);
  };
  const phone = await newPhone(env, { fetchFn }); await ready(env, phone);
  env.tick(60000);
  await phone.records.create('expenses', { amount: 5 });
  await desktopEdit(env, d => { d.clients[0].name = 'Changed'; });
  await rejectsWith(phone.app.sync(), 'unreachable');
  assert.equal((await phone.db.getMeta('session')).phase, 'committed');
  assert.equal((await phone.records.localChanges()).changes.length, 0);          // the computer has it: it is not queued again
  const r = await phone.app.sync();
  assert.equal(r.ok, true); assert.equal(r.totalsOk, true);
  assert.equal((await desktopData(env)).expenses.length, 1);
  assert.equal((await phone.records.get('clients', 3)).name, 'Changed');
  await sameLists(env, phone);
}));

test('edits made on the phone while a sync is running are not lost: they go up next time', { skip }, withEnv(async env => {
  let phone;
  const fetchFn = async (url, init) => {
    if (String(url).endsWith('/fp/sync/pull')) await phone.records.update('vehicles', 1, { reg: 'EDITED DURING SYNC' });
    return fetch(url, init);
  };
  phone = await newPhone(env, { fetchFn }); await ready(env, phone);
  env.tick(60000);
  await phone.records.create('expenses', { amount: 1 });
  await phone.app.sync();
  assert.equal((await phone.records.localChanges()).changes.length, 1);          // the in-sync edit is still waiting
}));

test('a record whose parent is missing on the computer is held, shown in the review list, and applied once the parent exists', { skip }, withEnv(async env => {
  const phone = await newPhone(env); await ready(env, phone);
  env.tick(60000);
  const rental = await phone.records.create('rentals', { vehicleId: 999, clientId: 3, amount: 10 });
  const r = await phone.app.sync();
  assert.equal(r.summary.held, 1);
  assert.equal((await desktopData(env)).rentals.some(x => x.id === rental.id), false, 'a record with a missing link never reaches the live data');
  const held = (await phone.app.review.open()).filter(i => i.kind === 'held');
  assert.equal(held.length, 1); assert.equal(held[0].recId, String(rental.id));

  env.tick(60000);
  await desktopEdit(env, d => { d.vehicles.push({ id: 999, reg: 'LATE 999' }); });
  await phone.app.sync();
  assert.equal((await desktopData(env)).rentals.some(x => x.id === rental.id), true);
  assert.equal((await phone.app.review.open()).filter(i => i.kind === 'held').length, 0);   // closed by itself
}));

test('a phone restored from an old backup is noticed and fully caught up, losing nothing', { skip }, withEnv(async env => {
  const dir = tmpDir(), secure = new Map();
  let phone = await newPhone(env, { dir, secure }); await ready(env, phone);
  await phone.db.read(q => q.exec('PRAGMA wal_checkpoint(TRUNCATE)'));
  const file = path.join(dir, 'fleetpilot-mobile.db'), old = path.join(dir, 'old-copy.db');
  fs.copyFileSync(file, old);                                                    // the "old backup"

  env.tick(60000);
  for (let i = 0; i < 3; i++) await phone.records.create('expenses', { amount: 10 + i });
  await phone.app.sync();
  assert.equal((await desktopData(env)).expenses.length, 3);
  await phone.db.close();

  for (const ext of ['', '-wal', '-shm']) fs.rmSync(file + ext, { force: true });
  fs.copyFileSync(old, file);                                                    // restore: the phone forgot the last 3 records
  phone = await newPhone(env, { dir, secure });
  assert.equal((await phone.records.all('expenses')).length, 0);

  const r = await phone.app.sync();
  assert.equal(r.restoredPhone, true);
  assert.equal(r.catchup, true);
  assert.equal(r.totalsOk, true);
  assert.equal((await phone.records.all('expenses')).length, 3);                 // they came back from the computer
  assert.equal((await desktopData(env)).expenses.length, 3);                     // and nothing was duplicated
  await sameLists(env, phone);
}));

test('a phone and a computer that disagree on totals are told so, and it goes in the review list', { skip }, withEnv(async env => {
  const phone = await newPhone(env); await ready(env, phone);
  await phone.db.write(q => q.run(`INSERT INTO records (list, id, data, at, dev, seq) VALUES ('payments', '77', '{"id":77,"amount":999}', '1970-01-01T00:00:00.000Z', 'D', 0)`));
  const r = await phone.app.sync();
  assert.equal(r.totalsOk, false);
  assert.ok((await phone.app.review.open()).some(i => i.kind === 'totals'));
}));

test('versions: an app that is too old, or too new, is told which one to update', { skip }, withEnv(async env => {
  const phone = await newPhone(env); await ready(env, phone);
  phone.platform.protocol = 99;
  await assert.rejects(phone.app.sync(), e => { assert.equal(e.code, 'update-desktop'); assert.match(e.message, /Update FleetPilot on the computer/); return true; });
  phone.platform.protocol = 0;
  await assert.rejects(phone.app.sync(), e => { assert.equal(e.code, 'update-app'); assert.match(e.message, /Update the phone app/); return true; });
  phone.platform.protocol = undefined;
  assert.equal((await phone.app.sync()).ok, true);
  assert.equal(phone.platform.awake.on, phone.platform.awake.off);
}));

/* ---------- clocks ---------- */
test('clock: a wrong phone clock waits for the owner\'s answer on the computer, then the sync goes on', { skip }, withEnv(async env => {
  const phone = await newPhone(env); await ready(env, phone);
  phone.clk.skew = 10 * 60 * 1000;                                               // the phone clock jumps 10 minutes
  const statuses = [];
  const syncing = phone.app.sync({ onStatus: s => statuses.push(s.state) });
  for (let i = 0; i < 300 && !env.sync.status().clockPending.length; i++) await sleep(10);
  const waiting = env.sync.status().clockPending;
  assert.equal(waiting.length, 1);
  assert.ok((await env.sync.setClock(waiting[0].device, 'phone')).ok);
  const r = await syncing;
  assert.equal(r.ok, true);
  assert.ok(statuses.includes('clock-pending'));
}));

test('clock: if nobody answers, the sync stops with a plain message and nothing changes', { skip }, withEnv(async env => {
  const phone = await newPhone(env); await ready(env, phone);
  phone.clk.skew = 10 * 60 * 1000;
  await phone.records.create('expenses', { amount: 1 });
  await rejectsWith(phone.app.sync(), 'clock-pending');
  assert.equal((await desktopData(env)).expenses.length, 0);
  assert.equal((await phone.records.localChanges()).changes.length, 1);
}));

/* ---------- keeping the green bar, and finding the computer again ---------- */
test('ping: the desktop sees the phone as connected; when the computer goes away the phone says so', { skip }, withEnv(async env => {
  const phone = await newPhone(env); await ready(env, phone);
  assert.equal(await phone.app.pinger.once(), 'connected');
  assert.equal(env.sync.barStatus().connected.length, 1);
  await env.sync.stop();
  assert.equal(await phone.app.pinger.once(), 'unreachable');
}));

test('the computer\'s address changed: the phone finds it again by asking the network', { skip }, async () => {
  const { createStore } = desktopModule('ledgerFile.cjs'), { createSync } = desktopModule('syncServer.cjs');
  const root = D.tmp(), clock = Date.parse('2026-11-08T10:00:00.000Z');
  const store = createStore({ root, now: () => new Date(clock) });
  await store.create('Main', D.baseData());
  const discoveryPort = 48000 + Math.floor(Math.random() * 1000);
  const sync = createSync({ store, port: 0, discovery: true, discoveryPort, now: () => new Date(clock), badPinDelayMs: 0, hooks: { beforeApply: async () => true, afterApply: async () => true } });
  const st = await sync.start('Main');
  const env = { sync, store, url: 'http://127.0.0.1:' + st.port, now: () => clock, discoveryPort };
  try {
    const phone = await newPhone(env);
    await ready(env, phone);
    const desktop = await phone.db.getMeta('desktop');
    await phone.db.setMeta('desktop', { ...desktop, addresses: ['127.0.0.1:1'] });                    // a stale address
    assert.equal(await phone.app.pinger.once(), 'connected');
    const saved = (await phone.db.getMeta('desktop')).addresses;
    assert.notEqual(saved[0], '127.0.0.1:1', 'the stale address was replaced');
    assert.ok(saved[0].endsWith(':' + st.port), 'the new address is remembered first');
    assert.equal((await phone.app.sync()).ok, true);
  } finally { await sync.stop(); store.closeAll(); }
});
