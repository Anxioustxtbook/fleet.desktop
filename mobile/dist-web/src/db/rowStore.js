/* The row-level steps used inside a transaction: record order, change numbers, writing a row, reading it back, and the number for a new record. */

import { LISTS, PROVISIONAL_BASE } from '../config.js';
import { FpError } from '../util.js';
import { metaGet, metaSet } from './database.js';

export const ORDER = new Map(LISTS.map((list, i) => [list, i]));
export const idNum = id => { const n = Number(id); return Number.isFinite(n) ? n : Infinity; };
export const byListThenId = (a, b) => (ORDER.get(a.list) - ORDER.get(b.list)) || (idNum(a.id) - idNum(b.id)) || String(a.id).localeCompare(String(b.id));
export const backToNumber = id => (String(id) !== '' && !isNaN(Number(id)) ? Number(id) : id);   // ids are numbers; keep anything else as it was

export function checkList(list) {
  if (!ORDER.has(list)) throw new FpError('bad-list', `Unknown list: ${list}`);
}

/* ---------- small steps used inside a transaction ---------- */
export async function nextSeq(q) {
  const seq = (await metaGet(q, 'seq', 0)) + 1;
  await metaSet(q, 'seq', seq);
  return seq;
}

export async function putRow(q, list, rec, at, dev, seq) {
  const data = JSON.stringify(rec), id = String(rec.id);
  await q.run(
    `INSERT INTO records (list, id, data, at, dev, seq) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(list, id) DO UPDATE SET data = excluded.data, at = excluded.at, dev = excluded.dev, seq = excluded.seq`,
    [list, id, data, at, dev, seq]);
  return { list, id, data };
}

/* The number for a new record: the next one in this phone's range, or, while the phone has no range yet (not paired), a temporary one.
   Temporary numbers are swapped for real ones by adoptRange() as soon as the phone is paired. */
export async function takeId(q) {
  const range = await metaGet(q, 'range');
  if (!range) {
    const next = await metaGet(q, 'localNext', PROVISIONAL_BASE);
    await metaSet(q, 'localNext', next + 1);
    return next;
  }
  const next = await metaGet(q, 'nextId', range.start);
  if (next > range.end) throw new FpError('range-full', 'This phone has used all of its record numbers. Pair it again to get a new range.');
  await metaSet(q, 'nextId', next + 1);
  return next;
}

/* Read back what was just written and compare it with what we meant to write. */
export async function verifyRows(q, written) {
  for (const w of written) {
    const row = await q.first('SELECT data FROM records WHERE list = ? AND id = ?', [w.list, w.id]);
    if (!row || row.data !== w.data)
      throw new FpError('readback', 'The phone stored something different from what it was given, so nothing was saved. Please try again.');
  }
}
export async function verifyGone(q, keys) {
  for (const k of keys) {
    const row = await q.first('SELECT 1 AS x FROM records WHERE list = ? AND id = ?', [k.list, k.id]);
    if (row) throw new FpError('readback', 'A deleted record was still found after the delete, so nothing was changed. Please try again.');
  }
}
