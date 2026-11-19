import { LISTS } from './config.js';
import { makePortableArchive, readPortableArchive } from './portableArchive.js';

export function createPortableFiles({ db, records, backup, identity, platform, now }) {
  async function undoState() {
    const undo = await db.getMeta('portableUndo', null);
    if (!undo) return { available: false, message: 'No recent import to undo.' };
    const [seq, ack] = await Promise.all([db.getMeta('seq', 0), db.getMeta('ack', 0)]);
    if (seq !== undo.expectedSeq || ack !== undo.expectedAck)
      return { available: false, message: 'Undo is no longer available because the phone has changed or synced since the import.' };
    return { available: true, message: 'Undo the most recent file import.' };
  }

  return {
    async export() {
      const data = {};
      for (const list of LISTS) data[list] = await records.all(list);
      const archive = makePortableArchive(data, { device: identity.phoneId, madeAt: now().toISOString() });
      const date = now().toISOString().slice(0, 10);
      await platform.fs.shareJson(`FleetPilot-${date}.json`, JSON.stringify(archive, null, 2));
      return { total: Object.values(data).reduce((sum, list) => sum + list.length, 0) };
    },

    async pick() {
      return platform.fs.pickJson();
    },

    async inspect(text) {
      return readPortableArchive(text, identity.phoneId);
    },

    async preview(text, mode) {
      if (mode !== 'merge' && mode !== 'replace') throw new Error('Choose Merge or Replace to review this import.');
      const { archive, total } = readPortableArchive(text, identity.phoneId);
      const snapshot = await records.captureSnapshot();
      const current = new Map(), tombstones = new Set();
      for (const list of LISTS) {
        for (const record of snapshot.records[list]) current.set(`${list}|${record.id}`, record);
      }
      snapshot.tombstones.forEach(item => tombstones.add(`${item.list}|${item.id}`));
      const incomingKeys = new Set(), result = { added: 0, updated: 0, skipped: 0, removed: 0 };
      for (const list of LISTS) {
        for (const record of archive.data[list]) {
          const key = `${list}|${record.id}`, previous = current.get(key);
          incomingKeys.add(key);
          if (mode === 'merge' && (previous || tombstones.has(key))) result.skipped++;
          else if (previous && JSON.stringify(previous) === JSON.stringify(record) && !tombstones.has(key)) result.skipped++;
          else if (previous) result.updated++;
          else result.added++;
        }
      }
      if (mode === 'replace') {
        for (const key of current.keys()) if (!incomingKeys.has(key)) result.removed++;
      }
      return {
        ...result, total,
        counts: Object.fromEntries(LISTS.map(list => [list, archive.data[list].length])),
        expected: { seq: snapshot.seq, ack: snapshot.ack }
      };
    },

    async import(text, mode, expected) {
      const { archive, total } = readPortableArchive(text, identity.phoneId);
      if (expected) {
        const [seq, ack] = await Promise.all([db.getMeta('seq', 0), db.getMeta('ack', 0)]);
        if (expected.seq !== seq || expected.ack !== ack)
          throw new Error('The phone changed after the file review. Review the import again before saving.');
      }
      if (mode === 'replace') {
        const safety = await backup.refresh();
        if (!safety || safety.ok !== true)
          throw new Error(`The safety backup could not be completed, so the import was cancelled.${safety && safety.error ? ` ${safety.error}` : ''}`);
      }
      const snapshot = await records.captureSnapshot();
      const result = await records.importSnapshot(archive.data, mode, { undoSnapshot: snapshot, expected });
      return { ...result, total };
    },

    async undo() {
      const state = await undoState();
      if (!state.available) throw new Error(state.message);
      const undo = await db.getMeta('portableUndo', null);
      await records.restoreSnapshot(undo.snapshot);
      return { ok: true };
    },

    undoState
  };
}
