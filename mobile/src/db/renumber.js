/* Renumbering: records entered before the phone was paired carry temporary numbers. Once the phone has its range, each one gets a real number
   (in the order entered), every link is pointed at the new numbers, and they are marked as changes to send. */

import { LINK_FIELDS, PROVISIONAL_BASE } from '../config.js';
import { FpError } from '../util.js';
import { metaGet, metaSet } from './database.js';
import { nextSeq, putRow, verifyRows } from './rowStore.js';

/* ONE transaction: all or nothing, and safe to run again (it does nothing when there is nothing temporary). Returns how many records were renumbered. */
export async function adoptRange({ db, identity, stamp }) {
  return db.write(async q => {
    const range = await metaGet(q, 'range'), top = await metaGet(q, 'localNext', null);
    if (!range || top == null) return 0;
    const isTemp = id => { const n = Number(id); return Number.isFinite(n) && n >= PROVISIONAL_BASE && n < top; };
    const rows = await q.all('SELECT list, id, data FROM records');
    const temps = rows.filter(r => isTemp(r.id)).sort((a, b) => (Number(a.id) - Number(b.id)));
    const map = new Map();
    let next = await metaGet(q, 'nextId', range.start);
    for (const r of temps) { if (next > range.end) throw new FpError('range-full', 'This phone has used all of its record numbers. Pair it again to get a new range.'); map.set(String(r.id), next++); }
    await metaSet(q, 'nextId', next);
    const relink = rec => { const out = { ...rec }; let changed = false; for (const k of LINK_FIELDS) if (out[k] != null && map.has(String(out[k]))) { out[k] = map.get(String(out[k])); changed = true; } return { out, changed }; };
    const written = [];
    for (const r of rows) {
      const old = JSON.parse(r.data), temp = isTemp(r.id), { out, changed } = relink(old);
      if (!temp && !changed) continue;
      if (temp) { out.id = map.get(String(r.id)); await q.run('DELETE FROM records WHERE list = ? AND id = ?', [r.list, String(r.id)]); await q.run('DELETE FROM arrivals WHERE list = ? AND id = ?', [r.list, String(r.id)]); }
      written.push(await putRow(q, r.list, out, stamp(), identity.phoneId, await nextSeq(q)));
    }
    await q.run('DELETE FROM tombstones WHERE CAST(id AS INTEGER) >= ? AND CAST(id AS INTEGER) < ?', [PROVISIONAL_BASE, top]);   // a record made and deleted before pairing was never known to the computer
    await verifyRows(q, written);
    await q.run(`DELETE FROM meta WHERE key = 'localNext'`);
    return temps.length;
  });
}
