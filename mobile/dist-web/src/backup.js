/* The developer backup: two files side by side in the app's folder, never shown on any screen.

     FleetPilot Mobile - developer.db     a full copy of the database (open it in DB Browser for SQLite)
     FleetPilot Mobile - developer.json   the same records as plain JSON (same shape as the desktop's)
     backup-log.txt                       one line per run, for the developer

   They are refreshed IN PLACE every 14 days, so there is never a pile of copies.
   A refresh can never spoil the last good backup: the new pair is written under temporary names, checked
   (integrity, record counts, JSON read back), and only then replaces the old pair. If anything fails,
   the old files stay as they were and the reason goes in the log. A missing file is made again at once.
   A failed backup never stops the app. */

import { APP_NAME, DEV_BACKUP_DAYS, DEV_BACKUP_NAME, LISTS } from './config.js';
import { iso } from './util.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const isOk = rows => rows.length === 1 && Object.values(rows[0])[0] === 'ok';

export function createDevBackup({ db, identity, platform, now }) {
  const fs = platform.fs;

  async function places() {
    const dir = await fs.backupFolder();
    const file = name => fs.join(dir, name);
    return {
      dir, log: file('backup-log.txt'),
      db: file(`${DEV_BACKUP_NAME}.db`), json: file(`${DEV_BACKUP_NAME}.json`),
      newDb: file(`${DEV_BACKUP_NAME}.db.new`), newJson: file(`${DEV_BACKUP_NAME}.json.new`),
      newDbName: `${DEV_BACKUP_NAME}.db.new`
    };
  }

  /* due when there is no backup yet, a file is missing, or the last one is 14 days old */
  async function dueNow() {
    const p = await places();
    const last = await db.getMeta('devBackupAt', null);
    if (!last) return true;
    if (!(await fs.exists(p.db)) || !(await fs.exists(p.json))) return true;
    return now().getTime() - Date.parse(last) >= DEV_BACKUP_DAYS * DAY_MS;
  }

  async function refresh() {
    const p = await places();
    const log = async text => { try { await fs.append(p.log, `${iso(now())}  ${text}\n`); } catch (e) { /* the log is only a help */ } };
    const clean = async () => { for (const f of [p.newDb, p.newJson]) { try { await fs.remove(f); } catch (e) { /* not there */ } } };
    try {
      await clean();
      const counts = await db.vacuumInto(fs.plainPath(p.newDb));              // one consistent copy; counts are from the same moment

      const copy = await platform.openDbAt(p.dir, p.newDbName);
      let json;
      try {
        if (!isOk(await copy.getAllAsync('PRAGMA integrity_check'))) throw new Error('the copy did not pass its integrity check');
        const have = {};
        (await copy.getAllAsync('SELECT list, COUNT(*) AS n FROM records GROUP BY list')).forEach(r => { have[r.list] = r.n; });
        for (const list of LISTS) if ((have[list] || 0) !== (counts[list] || 0)) throw new Error(`the copy has a different record count for ${list}`);
        const data = {};
        LISTS.forEach(list => { data[list] = []; });
        for (const r of await copy.getAllAsync('SELECT list, data FROM records ORDER BY list, rowid')) (data[r.list] || (data[r.list] = [])).push(JSON.parse(r.data));
        json = { app: APP_NAME, kind: 'developer-backup', database: 'fleetpilot-mobile', madeAt: iso(now()), device: identity.phoneId, counts: have, data };
      } finally {
        await copy.closeAsync();
      }

      await fs.write(p.newJson, JSON.stringify(json));
      const back = JSON.parse(await fs.read(p.newJson));                      // read it back
      for (const list of LISTS) if ((back.data[list] || []).length !== (json.counts[list] || 0)) throw new Error(`the JSON file did not read back correctly (${list})`);

      for (const [from, to] of [[p.newDb, p.db], [p.newJson, p.json]]) {      // both files are good: swap them in
        if (await fs.exists(to)) await fs.remove(to);
        await fs.move(from, to);
      }
      await db.setMeta('devBackupAt', iso(now()));
      await log(`ok: ${Object.values(json.counts).reduce((a, b) => a + b, 0)} records`);
      return { ok: true };
    } catch (e) {
      await clean();
      const reason = String((e && e.message) || e);
      await log(`failed: ${reason} (the older backup was kept)`);
      return { ok: false, error: reason };
    }
  }

  return {
    dueNow,
    refresh,
    /* called when the app opens and after a successful sync */
    async refreshIfDue() {
      try { return (await dueNow()) ? { ran: true, ...(await refresh()) } : { ran: false }; }
      catch (e) { return { ran: true, ok: false, error: String((e && e.message) || e) }; }
    }
  };
}
