/* The phone's SQLite file: opening it safely, the table layout, one-writer-at-a-time transactions,
   and "meta", a small notebook for the phone's own settings (ids, counters, sync position).

   Rules this file keeps:
   - the file is checked when it opens; a damaged file is never changed or replaced;
   - a database written by a newer app is refused instead of being damaged;
   - every write is ONE transaction, run one at a time, so two writes can never collide;
   - a full phone storage or a busy file is reported in plain words and leaves the data as it was. */

import { FpError } from '../util.js';

export const SCHEMA_VERSION = 1;

const TABLES = [
  /* the phone's own settings and counters (JSON values) */
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,

  /* one row per record. data = the whole record as JSON.
     seq = this phone's own change counter for the record: 0 means it came from the computer and is not to be sent back. */
  `CREATE TABLE IF NOT EXISTS records (
     list TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
     at TEXT NOT NULL, dev TEXT NOT NULL, seq INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (list, id))`,
  `CREATE INDEX IF NOT EXISTS records_seq ON records (seq) WHERE seq > 0`,

  /* a deleted record leaves a marker, so the delete reaches the computer and stays a delete */
  `CREATE TABLE IF NOT EXISTS tombstones (
     list TEXT NOT NULL, id TEXT NOT NULL, at TEXT NOT NULL, dev TEXT NOT NULL,
     seq INTEGER NOT NULL DEFAULT 0, data TEXT,
     PRIMARY KEY (list, id))`,

  /* the green dot: records that arrived from the computer, with the day they arrived. Never part of the record. */
  `CREATE TABLE IF NOT EXISTS arrivals (list TEXT NOT NULL, id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (list, id))`,

  /* things the owner should look at: records held by the computer, changes that were replaced, totals that differ */
  `CREATE TABLE IF NOT EXISTS review (
     id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, list TEXT, rec_id TEXT,
     title TEXT NOT NULL, payload TEXT, made_at TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'open')`
];

/* ---------- plain-words errors ---------- */
export function plainError(e) {
  if (e instanceof FpError) return e;
  const text = String((e && e.message) || e);
  if (/disk is full|SQLITE_FULL/i.test(text))
    return new FpError('storage-full', 'The phone storage is full, so nothing was saved. Free some space and try again.', { cause: text });
  if (/not a database|malformed|corrupt/i.test(text))
    return new FpError('damaged', 'The phone database did not pass its check. Nothing was changed or deleted. Please send the developer backup to the developer.', { cause: text });
  if (/locked|busy/i.test(text))
    return new FpError('busy', 'The phone database is busy. Wait a moment and try again. Nothing was changed.', { cause: text });
  return new FpError('db', 'The phone database could not be written, so nothing was changed.', { cause: text });
}

/* ---------- meta notebook (used inside a read or write) ---------- */
export async function metaGet(q, key, fallback = null) {
  const row = await q.first('SELECT value FROM meta WHERE key = ?', [key]);
  return row ? JSON.parse(row.value) : fallback;
}
export async function metaSet(q, key, value) {
  await q.run('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, JSON.stringify(value)]);
}

/* ---------- the connection wrapper ---------- */
export function createDb(raw) {
  let tail = Promise.resolve();
  const serial = fn => { const run = tail.then(fn); tail = run.catch(() => {}); return run; };   // everything runs one after another

  const q = {
    exec: sql => raw.execAsync(sql),
    run: (sql, params = []) => raw.runAsync(sql, params),
    all: (sql, params = []) => raw.getAllAsync(sql, params),
    first: async (sql, params = []) => (await raw.getFirstAsync(sql, params)) || null
  };

  const countsOf = async () => {
    const out = {};
    const rows = await q.all('SELECT list, COUNT(*) n FROM records GROUP BY list');
    rows.forEach(r => { out[r.list] = r.n; });
    return out;
  };

  return {
    /* read(q => ...): queued behind any write, so it never sees a half-written state */
    read: fn => serial(() => fn(q)).catch(e => { throw plainError(e); }),

    /* write(q => ...): one transaction. Any error rolls everything back and leaves the data as it was. */
    write: fn => serial(async () => {
      await q.exec('BEGIN IMMEDIATE');
      try {
        const out = await fn(q);
        await q.exec('COMMIT');
        return out;
      } catch (e) {
        try { await q.exec('ROLLBACK'); } catch (_) { /* nothing open */ }
        throw plainError(e);
      }
    }),

    getMeta: (key, fallback = null) => serial(() => metaGet(q, key, fallback)).catch(e => { throw plainError(e); }),
    setMeta: (key, value) => serial(async () => {
      await q.exec('BEGIN IMMEDIATE');
      try { await metaSet(q, key, value); await q.exec('COMMIT'); }
      catch (e) { try { await q.exec('ROLLBACK'); } catch (_) { /* nothing open */ } throw plainError(e); }
    }),

    /* a full consistent copy of the file (used by the developer backup); returns the record counts at that same moment */
    vacuumInto: plainPath => serial(async () => {
      await q.exec(`VACUUM INTO '${String(plainPath).replace(/'/g, "''")}'`);
      return countsOf();
    }).catch(e => { throw plainError(e); }),

    counts: () => serial(countsOf).catch(e => { throw plainError(e); }),
    close: () => serial(() => raw.closeAsync())
  };
}

/* ---------- open ---------- */
export async function openDatabase(platform, fileName = 'fleetpilot-mobile.db') {
  let raw;
  try { raw = await platform.openDb(fileName); } catch (e) { throw plainError(e); }
  const db = createDb(raw);

  await db.read(async q => {
    /* look first, change nothing: a damaged or newer file must stay exactly as it is */
    const check = await q.all('PRAGMA quick_check');
    const ok = check.length === 1 && Object.values(check[0])[0] === 'ok';
    if (!ok) throw new FpError('damaged', 'The phone database did not pass its check. Nothing was changed or deleted. Please send the developer backup to the developer.');
    const version = Object.values(await q.first('PRAGMA user_version'))[0];
    if (version > SCHEMA_VERSION)
      throw new FpError('too-new', 'This phone database was made by a newer FleetPilot app. Update the app. Nothing was changed.');
    await q.exec('PRAGMA synchronous = FULL');          // the safest setting: a finished write is on the disk
    await q.exec('PRAGMA journal_mode = WAL');
  });

  await db.write(async q => {
    for (const sql of TABLES) await q.exec(sql);
    await q.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
  return db;
}

/* The phone's permanent id, and the id of this database file.
   A restored old backup brings back its old `instance`; that is how the computer notices a phone that went back in time. */
export async function ensureIdentity(db, platform) {
  return db.write(async q => {
    let phoneId = await metaGet(q, 'phoneId');
    let instance = await metaGet(q, 'instance');
    if (!phoneId) { phoneId = 'P' + platform.randomId(12); await metaSet(q, 'phoneId', phoneId); }
    if (!instance) { instance = platform.randomId(8); await metaSet(q, 'instance', instance); }
    return { phoneId, instance };
  });
}
