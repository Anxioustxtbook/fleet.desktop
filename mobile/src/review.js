/* The review list: things the owner should look at. Nothing here is ever removed by sync on its own.

   kinds:
   - held      the computer is holding this phone's record aside (its car, client, driver or rental is missing there);
               it is tried again at every sync, and the item closes by itself once the computer has applied it
   - replaced  a change made on this phone lost against a newer change on the computer; the phone's version is kept here
               (the computer also keeps it and can Restore it)
   - totals    after a sync the phone and the computer disagree on a record count or an amount */

import { FpError, SEP, iso } from './util.js';

/* used inside a transaction by records.js as well */
export async function addReview(q, { kind, list = null, recId = null, title, payload = null }, madeAt) {
  const same = await q.first(
    `SELECT id FROM review WHERE state = 'open' AND kind = ? AND IFNULL(list, '') = ? AND IFNULL(rec_id, '') = ? AND title = ?`,
    [kind, list || '', recId == null ? '' : String(recId), title]);
  if (same) return same.id;
  const res = await q.run(
    'INSERT INTO review (kind, list, rec_id, title, payload, made_at) VALUES (?, ?, ?, ?, ?, ?)',
    [kind, list, recId == null ? null : String(recId), title, payload == null ? null : JSON.stringify(payload), madeAt]);
  return res.lastInsertRowId;
}

export function createReview({ db, now }) {
  const rowOut = r => ({ id: r.id, kind: r.kind, list: r.list, recId: r.rec_id, title: r.title, payload: r.payload ? JSON.parse(r.payload) : null, madeAt: r.made_at, state: r.state });

  return {
    add: item => db.write(q => addReview(q, item, iso(now()))),

    async open() {
      const rows = await db.read(q => q.all(`SELECT * FROM review WHERE state = 'open' ORDER BY id`));
      return rows.map(rowOut);
    },

    async count() {
      const row = await db.read(q => q.first(`SELECT COUNT(*) AS n FROM review WHERE state = 'open'`));
      return row.n;
    },

    /* The owner has seen it (or fixed it). The item is kept, not deleted. */
    resolve: id => db.write(q => q.run(`UPDATE review SET state = 'done' WHERE id = ?`, [id])),

    /* After a sync: `heldKeys` is what the computer is still holding aside. Close the held items it no longer holds,
       and open one for each it does. */
    async syncHeld(heldKeys) {
      const held = (heldKeys || []).map(k => { const [list, id] = String(k).split(SEP); return { list, id }; });
      const madeAt = iso(now());
      return db.write(async q => {
        const open = await q.all(`SELECT id, list, rec_id FROM review WHERE state = 'open' AND kind = 'held'`);
        const stillHeld = new Set(held.map(h => h.list + SEP + h.id));
        for (const item of open) {
          if (!stillHeld.has(item.list + SEP + item.rec_id)) await q.run(`UPDATE review SET state = 'done' WHERE id = ?`, [item.id]);
        }
        for (const h of held) {
          await addReview(q, {
            kind: 'held', list: h.list, recId: h.id,
            title: `Waiting for the computer: ${h.list} ${h.id} (something it points to is missing there)`
          }, madeAt);
        }
        return held.length;
      });
    }
  };
}

/* ---------- what the owner can do with an item (the screens only call these) ---------- */

/* "Restore my version": the phone puts its own version back as a new edit. Being newer, it wins at the next sync. */
export async function restoreMine({ records, review }, item) {
  const yours = item.payload && item.payload.yours;
  if (!yours) throw new FpError('no-copy', 'The phone no longer has your version of this record.');
  await records.update(item.list, item.recId, yours);
  await review.resolve(item.id);
}
