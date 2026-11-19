/* Everything that reads or writes ledger records on the phone.

   - Record numbers come from this phone's own range (given at pairing), so they never clash with the computer's.
   - Every local create, edit and delete is tracked (time, phone id, change number) so the next sync knows what to send.
   - Every write is ONE transaction and is read back before it is committed; if what SQLite holds differs from
     what was written, the whole write is rolled back and an error is shown (nothing is half-saved).
   - Changes pulled from the computer follow the rules in SYNC_SPEC.md ("a delete stays a delete", etc.). */

import { LISTS, EPOCH } from '../config.js';
import { FpError, dayOf, iso, keyOf, num, round2 } from '../util.js';
import { metaGet, metaSet } from './database.js';
import { addReview } from '../review.js';
import { idNum, byListThenId, backToNumber, checkList, nextSeq, putRow, takeId, verifyRows, verifyGone } from './rowStore.js';
import { adoptRange } from './renumber.js';

export function createRecords({ db, identity, now }) {
  const stamp = () => iso(now());

  return {
    /* ---------- local work (what the screens will call) ---------- */

    /* A new record. Its number comes from this phone's range. */
    async create(list, fields) {
      checkList(list);
      return db.write(async q => {
        const rec = { ...fields, id: await takeId(q) };
        const written = await putRow(q, list, rec, stamp(), identity.phoneId, await nextSeq(q));
        await verifyRows(q, [written]);
        return rec;
      });
    },

    /* Records entered before the phone was paired get real numbers once it is paired (see renumber.js). */
    adoptRange: () => adoptRange({ db, identity, stamp }),

    /* Change a record: the patch is merged into the whole record, and the whole record is what gets sent. */
    async update(list, id, patch) {
      checkList(list);
      return db.write(async q => {
        const row = await q.first('SELECT data FROM records WHERE list = ? AND id = ?', [list, String(id)]);
        if (!row) throw new FpError('not-found', 'That record is no longer on the phone.');
        const rec = { ...JSON.parse(row.data), ...patch, id: JSON.parse(row.data).id };
        const written = await putRow(q, list, rec, stamp(), identity.phoneId, await nextSeq(q));
        await verifyRows(q, [written]);
        return rec;
      });
    },

    /* Delete a record: it leaves a hidden marker so the delete reaches the computer. */
    async remove(list, id) {
      checkList(list);
      return db.write(async q => {
        const key = { list, id: String(id) };
        const row = await q.first('SELECT data FROM records WHERE list = ? AND id = ?', [list, key.id]);
        if (!row) return false;
        await q.run('DELETE FROM records WHERE list = ? AND id = ?', [list, key.id]);
        await q.run(
          `INSERT INTO tombstones (list, id, at, dev, seq, data) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(list, id) DO UPDATE SET at = excluded.at, dev = excluded.dev, seq = excluded.seq, data = excluded.data`,
          [list, key.id, stamp(), identity.phoneId, await nextSeq(q), row.data]);
        await q.run('DELETE FROM arrivals WHERE list = ? AND id = ?', [list, key.id]);
        await verifyGone(q, [key]);
        return true;
      });
    },

    /* Several saves as ONE transaction (an entry form that adds a client and a rental and a fuel line, say): all of them are kept, or none.
       ops = [{ op: 'create', list, fields }, { op: 'update', list, id, patch }, { op: 'remove', list, id }].
       `fields` and `patch` may be functions of the results so far (results[i] is what op i returned), so a rental can point at the client made just before it.
       Returns the results in the same order (a remove returns true or false). Every record is read back before the commit, like every other write. */
    async saveBatch(ops) {
      if (!Array.isArray(ops) || !ops.length) return [];
      ops.forEach(o => checkList(o.list));
      return db.write(async q => {
        const results = [], written = [], gone = [];
        for (const o of ops) {
          if (o.op === 'create') {
            const rec = { ...(typeof o.fields === 'function' ? o.fields(results) : o.fields), id: await takeId(q) };
            written.push(await putRow(q, o.list, rec, stamp(), identity.phoneId, await nextSeq(q)));
            results.push(rec);
          } else if (o.op === 'update') {
            const row = await q.first('SELECT data FROM records WHERE list = ? AND id = ?', [o.list, String(o.id)]);
            if (!row) throw new FpError('not-found', 'That record is no longer on the phone.');
            const old = JSON.parse(row.data), patch = typeof o.patch === 'function' ? o.patch(results) : o.patch;
            const rec = { ...old, ...patch, id: old.id };
            written.push(await putRow(q, o.list, rec, stamp(), identity.phoneId, await nextSeq(q)));
            results.push(rec);
          } else if (o.op === 'remove') {
            const key = { list: o.list, id: String(o.id) };
            const row = await q.first('SELECT data FROM records WHERE list = ? AND id = ?', [key.list, key.id]);
            if (row) {
              await q.run('DELETE FROM records WHERE list = ? AND id = ?', [key.list, key.id]);
              await q.run(
                `INSERT INTO tombstones (list, id, at, dev, seq, data) VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(list, id) DO UPDATE SET at = excluded.at, dev = excluded.dev, seq = excluded.seq, data = excluded.data`,
                [key.list, key.id, stamp(), identity.phoneId, await nextSeq(q), row.data]);
              await q.run('DELETE FROM arrivals WHERE list = ? AND id = ?', [key.list, key.id]);
              gone.push(key);
            }
            results.push(!!row);
          } else throw new FpError('bad-op', `Unknown save step: ${o.op}`);
        }
        await verifyRows(q, written);
        await verifyGone(q, gone);
        return results;
      });
    },

    async get(list, id) {
      const row = await db.read(q => q.first('SELECT data FROM records WHERE list = ? AND id = ?', [list, String(id)]));
      return row ? JSON.parse(row.data) : null;
    },

    async all(list) {
      checkList(list);
      const rows = await db.read(q => q.all('SELECT id, data FROM records WHERE list = ?', [list]));
      return rows.sort((a, b) => idNum(a.id) - idNum(b.id)).map(r => JSON.parse(r.data));
    },

    async hasData() {
      return db.read(async q => !!(await q.first('SELECT 1 AS x FROM records LIMIT 1')) || !!(await q.first('SELECT 1 AS x FROM tombstones LIMIT 1')));
    },

    async captureSnapshot() {
      return db.read(async q => {
        const snapshot = {
          records: {}, tombstones: [],
          seq: await metaGet(q, 'seq', 0), ack: await metaGet(q, 'ack', 0)
        };
        for (const list of LISTS) {
          snapshot.records[list] = (await q.all('SELECT data FROM records WHERE list = ?', [list])).map(row => JSON.parse(row.data));
        }
        snapshot.tombstones = (await q.all('SELECT list, id, data FROM tombstones')).map(row => ({
          list: row.list, id: backToNumber(row.id), data: row.data == null ? null : JSON.parse(row.data)
        }));
        return snapshot;
      });
    },

    async importSnapshot(data, mode, { undoSnapshot = null, expected = null } = {}) {
      if (mode !== 'merge' && mode !== 'replace') throw new FpError('bad-import-mode', 'Choose Merge or Replace before importing.');
      const incoming = [];
      for (const list of LISTS) {
        if (!Array.isArray(data[list])) throw new FpError('bad-import', `The archive is missing the ${list} records.`);
        const ids = new Set();
        for (const record of data[list]) {
          if (!record || typeof record !== 'object' || Array.isArray(record) || record.id == null)
            throw new FpError('bad-import', `The archive contains an invalid ${list} record.`);
          const id = String(record.id);
          if (ids.has(id)) throw new FpError('bad-import', `The archive contains duplicate ${list} record numbers.`);
          ids.add(id);
          incoming.push({ list, id, record });
        }
      }

      return db.write(async q => {
        if (expected && (
          expected.seq !== await metaGet(q, 'seq', 0) ||
          expected.ack !== await metaGet(q, 'ack', 0)
        )) throw new FpError('archive-stale', 'The phone changed after the file review. Review the import again before saving.');
        const currentRows = await q.all('SELECT list, id, data FROM records');
        const current = new Map(currentRows.map(row => [`${row.list}|${row.id}`, row]));
        const tombRows = await q.all('SELECT list, id FROM tombstones');
        const tombstones = new Set(tombRows.map(row => `${row.list}|${row.id}`));
        const incomingKeys = new Set(incoming.map(item => `${item.list}|${item.id}`));
        const result = { added: 0, updated: 0, skipped: 0, removed: 0 };
        const written = [], gone = [];

        if (mode === 'replace') {
          for (const row of currentRows) {
            const key = `${row.list}|${row.id}`;
            if (incomingKeys.has(key)) continue;
            await q.run('DELETE FROM records WHERE list = ? AND id = ?', [row.list, row.id]);
            await q.run(
              `INSERT INTO tombstones (list, id, at, dev, seq, data) VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(list, id) DO UPDATE SET at = excluded.at, dev = excluded.dev, seq = excluded.seq, data = excluded.data`,
              [row.list, row.id, stamp(), identity.phoneId, await nextSeq(q), row.data]);
            await q.run('DELETE FROM arrivals WHERE list = ? AND id = ?', [row.list, row.id]);
            gone.push({ list: row.list, id: row.id });
            result.removed++;
          }
        }

        for (const item of incoming) {
          const key = `${item.list}|${item.id}`, previous = current.get(key);
          const deleted = tombstones.has(key);
          if (mode === 'merge' && (previous || deleted)) { result.skipped++; continue; }
          const serialized = JSON.stringify(item.record);
          if (mode === 'replace' && previous && previous.data === serialized && !deleted) continue;
          await q.run('DELETE FROM tombstones WHERE list = ? AND id = ?', [item.list, item.id]);
          written.push(await putRow(q, item.list, item.record, stamp(), identity.phoneId, await nextSeq(q)));
          if (previous) result.updated++; else result.added++;
        }
        await verifyRows(q, written);
        await verifyGone(q, gone);
        if (undoSnapshot && result.added + result.updated + result.removed > 0) {
          await metaSet(q, 'portableUndo', {
            snapshot: undoSnapshot,
            expectedSeq: await metaGet(q, 'seq', 0),
            expectedAck: await metaGet(q, 'ack', 0)
          });
        }
        return result;
      });
    },

    async restoreSnapshot(snapshot) {
      const active = [];
      for (const list of LISTS) {
        if (!Array.isArray(snapshot.records[list])) throw new FpError('bad-undo', `The saved undo copy is missing ${list} records.`);
        for (const record of snapshot.records[list]) {
          if (!record || record.id == null) throw new FpError('bad-undo', `The saved undo copy contains an invalid ${list} record.`);
          active.push({ list, record });
        }
      }
      const deleted = snapshot.tombstones || [];
      const keys = new Set();
      active.forEach(item => keys.add(`${item.list}|${item.record.id}`));
      deleted.forEach(item => {
        if (!LISTS.includes(item.list) || item.id == null) throw new FpError('bad-undo', 'The saved undo copy contains an invalid deleted record.');
        const key = `${item.list}|${item.id}`;
        if (keys.has(key)) throw new FpError('bad-undo', 'The saved undo copy has a record marked as both active and deleted.');
        keys.add(key);
      });

      return db.write(async q => {
        const currentRows = await q.all('SELECT list, id, data FROM records');
        const restoredKeys = new Set(active.map(item => `${item.list}|${item.record.id}`));
        deleted.forEach(item => restoredKeys.add(`${item.list}|${item.id}`));
        const newDeletes = currentRows.filter(row => !restoredKeys.has(`${row.list}|${row.id}`));
        await q.run('DELETE FROM records');
        await q.run('DELETE FROM tombstones');
        await q.run('DELETE FROM arrivals');
        const written = [], gone = [];

        for (const item of active) {
          written.push(await putRow(q, item.list, item.record, stamp(), identity.phoneId, await nextSeq(q)));
        }
        for (const item of deleted) {
          await q.run(
            `INSERT INTO tombstones (list, id, at, dev, seq, data) VALUES (?, ?, ?, ?, ?, ?)`,
            [item.list, String(item.id), stamp(), identity.phoneId, await nextSeq(q), item.data == null ? null : JSON.stringify(item.data)]);
          gone.push({ list: item.list, id: String(item.id) });
        }
        for (const row of newDeletes) {
          await q.run(
            `INSERT INTO tombstones (list, id, at, dev, seq, data) VALUES (?, ?, ?, ?, ?, ?)`,
            [row.list, row.id, stamp(), identity.phoneId, await nextSeq(q), row.data]);
          gone.push({ list: row.list, id: row.id });
        }
        await verifyRows(q, written);
        await verifyGone(q, gone);
        await metaSet(q, 'portableUndo', null);
      });
    },

    /* ---------- what to send ---------- */

    /* The changes the computer does not have yet: records and deletes made after the last successful sync.
       `all` (catch-up) sends every record. `upTo` keeps a half-finished sync's set of changes the same when it is resumed.
       Parents first, deletes last. `seq` is the change number this set goes up to. */
    async localChanges({ all = false, upTo = null } = {}) {
      return db.read(async q => {
        const pushed = await metaGet(q, 'pushedSeq', 0);
        const top = upTo != null ? upTo : await metaGet(q, 'seq', 0);
        const rows = all
          ? await q.all('SELECT list, id, data, at, dev FROM records')
          : await q.all('SELECT list, id, data, at, dev FROM records WHERE seq > ? AND seq <= ?', [pushed, top]);
        const tombs = all
          ? await q.all('SELECT list, id, at, dev FROM tombstones WHERE seq > 0')
          : await q.all('SELECT list, id, at, dev FROM tombstones WHERE seq > ? AND seq <= ?', [pushed, top]);
        const upserts = rows.sort(byListThenId).map(r => {
          const data = JSON.parse(r.data);
          return { list: r.list, id: data.id, deleted: false, at: r.at, dev: r.dev, data };
        });
        const deletes = tombs.sort(byListThenId).map(t => ({ list: t.list, id: backToNumber(t.id), deleted: true, at: t.at, dev: t.dev }));
        return { changes: [...upserts, ...deletes], seq: top };
      });
    },

    /* The computer has the changes up to this number: they are not sent again. */
    async markPushed(seq) {
      return db.write(async q => {
        if (seq > (await metaGet(q, 'pushedSeq', 0))) await metaSet(q, 'pushedSeq', seq);
      });
    },

    /* ---------- what arrives ---------- */

    /* One page of the first full copy. No green dots, and old times so a later edit always counts as newer. */
    async applyFullPage(list, records, { preserveLocal = false } = {}) {
      checkList(list);
      return db.write(async q => {
        const written = [];
        for (const rec of records) {
          if (!rec || rec.id == null) continue;
          if (preserveLocal) {
            const existing = await q.first('SELECT seq FROM records WHERE list = ? AND id = ?', [list, String(rec.id)]);
            const deleted = await q.first('SELECT 1 AS x FROM tombstones WHERE list = ? AND id = ?', [list, String(rec.id)]);
            if ((existing && existing.seq > 0) || deleted) continue;
          }
          await q.run('DELETE FROM tombstones WHERE list = ? AND id = ?', [list, String(rec.id)]);
          written.push(await putRow(q, list, rec, EPOCH, 'D', 0));
        }
        await verifyRows(q, written);
        return written.length;
      });
    },

    /* Every change pulled in one sync, applied in ONE transaction (parents first, deletes last).
       `pushedBefore` is the change number the computer already had before this sync: a record this phone
       sent in this very sync and the computer then answered with a different version is a lost conflict,
       and the phone's version is kept in the review list. */
    async applyPulled(changes, { pushedBefore = null } = {}) {
      const ordered = [...changes.filter(c => !c.deleted).sort(byListThenId), ...changes.filter(c => c.deleted).sort(byListThenId)];
      const today = dayOf(now());
      return db.write(async q => {
        const pushed = await metaGet(q, 'pushedSeq', 0);
        const out = { upserted: 0, deleted: 0, ignored: 0, keptLocal: 0, replaced: 0 };
        const written = [], gone = [];

        for (const c of ordered) {
          checkList(c.list);
          const id = String(c.id);
          const row = await q.first('SELECT data, seq FROM records WHERE list = ? AND id = ?', [c.list, id]);

          /* an edit made on the phone after this sync started is newer than anything pulled: keep it, it goes up next time */
          if (row && row.seq > pushed) { out.keptLocal++; continue; }

          if (c.deleted) {
            if (row) await q.run('DELETE FROM records WHERE list = ? AND id = ?', [c.list, id]);
            await q.run(
              `INSERT INTO tombstones (list, id, at, dev, seq, data) VALUES (?, ?, ?, ?, 0, ?)
               ON CONFLICT(list, id) DO UPDATE SET at = excluded.at, dev = excluded.dev, seq = 0, data = excluded.data`,
              [c.list, id, c.at, c.dev, row ? row.data : null]);
            await q.run('DELETE FROM arrivals WHERE list = ? AND id = ?', [c.list, id]);
            gone.push({ list: c.list, id });
            out.deleted++;
            continue;
          }

          const tomb = await q.first('SELECT 1 AS x FROM tombstones WHERE list = ? AND id = ?', [c.list, id]);
          if (tomb && !c.restore) { out.ignored++; continue; }                  // a delete stays a delete
          if (tomb) await q.run('DELETE FROM tombstones WHERE list = ? AND id = ?', [c.list, id]);   // Restore chosen on the computer
          const rec = c.data;
          if (!rec || rec.id == null) { out.ignored++; continue; }

          const text = JSON.stringify(rec);
          if (row && pushedBefore != null && row.seq > pushedBefore && row.data !== text) {
            await addReview(q, {
              kind: 'replaced', list: c.list, recId: id,
              title: `Your change to ${c.list} ${id} was replaced by a newer change made on the computer`,
              payload: { yours: JSON.parse(row.data) }
            }, stamp());
            out.replaced++;
          }
          written.push(await putRow(q, c.list, rec, c.at, c.dev, 0));
          await q.run(
            'INSERT INTO arrivals (list, id, day) VALUES (?, ?, ?) ON CONFLICT(list, id) DO UPDATE SET day = excluded.day',
            [c.list, id, today]);
          out.upserted++;
        }

        await verifyRows(q, written);
        await verifyGone(q, gone);
        return out;
      });
    },

    /* ---------- checks and the green dot ---------- */

    /* record count and the sum of "amount" for every list: the same rule the computer uses */
    async totals() {
      return db.read(async q => {
        const out = {};
        for (const list of LISTS) {
          let n = 0, sum = 0;
          for (const r of await q.all('SELECT data FROM records WHERE list = ?', [list])) { n++; sum += num(JSON.parse(r.data).amount); }
          out[list] = { n, sum: round2(sum) };
        }
        return out;
      });
    },

    counts: () => db.counts(),

    /* keys of the records that arrived today (they show a green dot) */
    async newToday() {
      const rows = await db.read(q => q.all('SELECT list, id FROM arrivals WHERE day = ?', [dayOf(now())]));
      return new Set(rows.map(r => keyOf(r.list, r.id)));
    },
    /* the dot goes the next day */
    async clearOldArrivals() {
      return db.write(q => q.run('DELETE FROM arrivals WHERE day <> ?', [dayOf(now())]));
    }
  };
}
