/* The two things the phone does with the computer (SYNC_SPEC.md):

   fullCopy()  the first full copy of the whole ledger, page by page, with progress.
   syncNow()   one sync: send this phone's changes, then receive the computer's.

   Safety rules kept here:
   - changes go up in small numbered batches; the computer keeps each batch and applies them together;
   - a sync that is cut off (Wi-Fi drops, app closed) is saved as a "session" and carries on from the last
     finished batch next time, with the same set of changes, so nothing is lost or applied twice;
   - everything pulled is applied in ONE transaction, read back, and only then is the computer told it was delivered;
   - the phone's own change counter only moves after the computer confirmed the commit;
   - a wrong clock never blocks syncing: the sync waits while the owner answers the question on the computer. */

import { APP_VERSION, BATCH_SIZE, CLOCK_RETRY_MS, CLOCK_WAIT_MS, PAGE_SIZE, PROTOCOL } from '../config.js';
import { FpError, SEP, chunk, fingerprint, iso, sleep } from '../util.js';
import { metaSet } from '../db/database.js';

export function createEngine({ db, records, review, client, pairing, identity, platform, now }) {
  const protocolNow = () => (platform.protocol != null ? platform.protocol : PROTOCOL);   // read each time, so tests can change it

  /* the computer's address and the phone's key, ready to use */
  async function open() {
    const link = await pairing.link();
    return { auth: link.auth, desktop: link.desktop, address: await pairing.reach(link) };
  }
  const post = (c, path, body) => client.post(c.address, path, body, c.auth);

  async function withAwake(fn) {
    if (platform.keepAwake) await platform.keepAwake.on();
    try { return await fn(); } finally { if (platform.keepAwake) await platform.keepAwake.off(); }
  }

  /* ---------- the first full copy ---------- */
  async function fullCopy({ merge = false, onProgress = () => {} } = {}) {
    return withAwake(async () => {
      const c = await open();
      const resuming = await db.getMeta('copyStarted', false);                // an earlier copy was cut off: carry on, it is not a merge
      if (!merge && !resuming && await records.hasData())
        throw new FpError('not-empty', 'This phone already holds records. Copying the computer\'s records in will merge them with these. Continue only if that is what you want.');

      const begin = await post(c, '/fp/full/begin', { protocol: protocolNow() });
      if (!resuming) await db.setMeta('copyStarted', true);
      const total = Object.values(begin.counts || {}).reduce((a, b) => a + b, 0);
      let cursor = { li: 0, off: 0 }, done = false, copied = 0;
      while (!done) {
        const page = await post(c, '/fp/full/page', { li: cursor.li, off: cursor.off, size: PAGE_SIZE });
        if (page.list && page.records.length) copied += await records.applyFullPage(page.list, page.records, { preserveLocal: merge });
        onProgress({ phase: 'copy', done: copied, total });
        done = page.done;
        cursor = page.next || cursor;
      }

      const fin = await post(c, '/fp/full/done', { snapshotSeq: begin.snapshotSeq, totals: await records.totals(), appVersion: APP_VERSION });
      await db.write(async q => {
        await metaSet(q, 'ack', begin.snapshotSeq);
        await metaSet(q, 'needsFullCopy', false);
        await metaSet(q, 'copyStarted', false);
        await metaSet(q, 'lastSyncAt', iso(now()));
      });
      if (!fin.totalsOk && (!merge || resuming))
        await review.add({ kind: 'totals', title: 'After the first copy, the phone and the computer do not agree on some counts or amounts', payload: fin.diff });
      return { ok: true, copied, totalsOk: fin.totalsOk, diff: fin.diff };
    });
  }

  /* ---------- one sync ---------- */
  async function beginWithClockWait(c, session, ack, mode, onStatus) {
    const giveUp = Date.now() + (platform.clockWaitMs != null ? platform.clockWaitMs : CLOCK_WAIT_MS);
    for (;;) {
      try {
        return await post(c, '/fp/sync/begin', {
          session, phoneTime: iso(now()), appVersion: APP_VERSION, protocol: protocolNow(), instance: identity.instance,
          phoneSeq: await db.getMeta('seq', 0), ack, mode
        });
      } catch (e) {
        if (e.code !== 'clock-pending') throw e;
        onStatus({ state: 'clock-pending', message: 'Answer the question on the computer. The sync will go on by itself.' });
        if (Date.now() > giveUp) throw e;
        await sleep(platform.clockRetryMs != null ? platform.clockRetryMs : CLOCK_RETRY_MS);
      }
    }
  }

  const newSession = (pushedBefore) => ({ id: 'S' + platform.randomId(14), phase: 'new', pushedBefore });
  const fingerprintOf = changes => fingerprint(changes.map(x => [x.list, x.id, x.at, x.deleted ? 'd' : 'u'].join(SEP)).join('|'));

  async function runSession(c, { mode, onProgress, onStatus }) {
    const ack = await db.getMeta('ack', 0);
    let s = await db.getMeta('session', null) || newSession(await db.getMeta('pushedSeq', 0));
    let begin, collected = null;

    /* begin; if a half-finished session no longer matches the phone's data, start a new one once */
    for (let round = 0; round < 2; round++) {
      begin = await beginWithClockWait(c, s.id, ack, mode, onStatus);
      if (s.phase === 'committed') break;                                    // the computer already has our changes
      const resuming = s.phase === 'pushing';
      const all = resuming ? s.all : !!begin.catchup;                         // catch-up: every record, not only the changes
      collected = await records.localChanges({ all, upTo: resuming ? s.seqAtCollect : null });
      const fp = fingerprintOf(collected.changes);
      if (resuming && fp !== s.fp) { s = newSession(await db.getMeta('pushedSeq', 0)); await db.setMeta('session', null); continue; }
      if (!resuming) {
        s = { id: s.id, phase: 'pushing', all, seqAtCollect: collected.seq, n: collected.changes.length, fp, pushedBefore: s.pushedBefore };
        await db.setMeta('session', s);                                       // saved before anything is sent, so a cut-off can resume
      }
      break;
    }

    /* send what the computer does not have */
    if (s.phase === 'pushing') {
      const batches = chunk(collected.changes, BATCH_SIZE);
      const have = new Set(begin.received || []);
      for (let i = 0; i < batches.length; i++) {
        if (have.has(i + 1)) continue;                                        // already stored by the computer
        await post(c, '/fp/sync/push', { session: s.id, batch: i + 1, changes: batches[i] });
        onProgress({ phase: 'push', done: i + 1, total: batches.length });
      }
      let res;
      for (let tries = 0; ; tries++) {
        try { res = await post(c, '/fp/sync/commit', { session: s.id, batches: batches.length }); break; }
        catch (e) {
          if (e.code === 'missing-batch' && tries < 3 && e.extra && e.extra.missing) {      // one batch did not arrive: send it again
            const i = e.extra.missing;
            await post(c, '/fp/sync/push', { session: s.id, batch: i, changes: batches[i - 1] || [] });
            continue;
          }
          throw e;
        }
      }
      await records.markPushed(s.seqAtCollect);                               // only now: the computer confirmed it has them
      s = { ...s, phase: 'committed', pullUpTo: res.pullUpTo, heldKeys: res.heldKeys || [], summary: res.summary };
      await db.setMeta('session', s);
      await review.syncHeld(s.heldKeys);
    }

    /* receive what the phone does not have */
    const pulled = [];
    let cursor = -1;
    for (;;) {
      const page = await post(c, '/fp/sync/pull', { session: s.id, cursor, limit: PAGE_SIZE });
      pulled.push(...page.changes);
      cursor = page.next;
      onProgress({ phase: 'pull', done: pulled.length });
      if (page.done) break;
    }
    const applied = await records.applyPulled(pulled, { pushedBefore: s.pushedBefore });

    /* tell the computer it was delivered, and compare totals */
    const fin = await post(c, '/fp/sync/finish', { session: s.id, ack: s.pullUpTo, totals: await records.totals() });
    await db.write(async q => {
      await metaSet(q, 'ack', s.pullUpTo);
      await metaSet(q, 'lastSyncAt', iso(now()));
      await metaSet(q, 'session', null);
    });
    if (!fin.totalsOk)
      await review.add({ kind: 'totals', title: 'After the sync, the phone and the computer do not agree on some counts or amounts', payload: fin.diff });
    await records.clearOldArrivals();

    return {
      ok: true, pushed: collected ? collected.changes.length : s.n || 0, pulled: pulled.length, applied, summary: s.summary || null,
      totalsOk: fin.totalsOk, diff: fin.diff, held: fin.held, catchup: !!begin.catchup,
      restoredPhone: !!begin.restoredPhone, restoredDesktop: !!begin.restoredDesktop
    };
  }

  async function syncNow({ mode, onProgress = () => {}, onStatus = () => {} } = {}) {
    return withAwake(async () => {
      if (await db.getMeta('needsFullCopy', false))
        throw new FpError('needs-full-copy', 'This phone has not received its first full copy yet. Do that first.');
      const c = await open();
      for (let attempt = 0; ; attempt++) {
        try { return await runSession(c, { mode, onProgress, onStatus }); }
        catch (e) {
          if (e.code === 'unknown-session' && attempt < 1) { await db.setMeta('session', null); continue; }     // the computer restarted mid-sync: begin again
          throw e;
        }
      }
    });
  }

  return { fullCopy, syncNow };
}
