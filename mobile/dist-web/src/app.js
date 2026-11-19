/* The one place where the modules are joined. Screens (Step 2B onward) only ever talk to what createApp() returns:

     app.pairing   parseQr, pair, unpair, link
     app.engine    fullCopy, syncNow
     app.records   create, update, remove, get, all, newToday ...
     app.review    open, count, resolve
     app.pinger    start, stop           (call from the app's foreground / background events)
     app.sync()    syncNow, then the developer backup check
     app.status()  a small summary for a status bar

   Tests build the same thing with Node stand-ins instead of Expo (see test/helpers.js). */

import { openDatabase, ensureIdentity } from './db/database.js';
import { createRecords } from './db/records.js';
import { createReview } from './review.js';
import { createClient } from './sync/client.js';
import { createPairing } from './sync/pairing.js';
import { createEngine } from './sync/engine.js';
import { createPinger } from './sync/ping.js';
import { createDevBackup } from './backup.js';
import { createCsvExport } from './csvExport.js';
import { createPortableFiles } from './portableFiles.js';
import { createExcelFiles } from './excelFiles.js';

export async function createApp(platform, { onPingState } = {}) {
  const db = await openDatabase(platform);
  const identity = await ensureIdentity(db, platform);
  const now = platform.now;

  const records = createRecords({ db, identity, now });
  const review = createReview({ db, now });
  const client = createClient({ fetchFn: platform.fetchFn });
  const basePairing = createPairing({ db, identity, client, platform, now });
  /* what was entered before pairing gets its real record numbers the moment the phone is paired */
  const pairing = { ...basePairing, async pair(options) { const done = await basePairing.pair(options); await records.adoptRange(); return done; } };
  const engine = createEngine({ db, records, review, client, pairing, identity, platform, now });
  const pinger = createPinger({ pairing, client, platform, onState: onPingState });
  const backup = createDevBackup({ db, identity, platform, now });
  const csvExport = createCsvExport({ db, records, platform, now });
  const portableFiles = createPortableFiles({ db, records, backup, identity, platform, now });
  const excelFiles = createExcelFiles({ records, backup, platform, now });

  return {
    db, identity, records, review, pairing, engine, pinger, backup, csvExport, portableFiles, excelFiles, isWeb: platform.isWeb === true,

    /* when the app opens: the green dots of earlier days go, and the developer backup is checked */
    async onOpen() {
      await records.adoptRange();                                          // in case the app was closed between pairing and renumbering
      await records.clearOldArrivals();
      return backup.refreshIfDue();
    },

    /* one sync, then the backup check (a failed backup never fails the sync) */
    async sync(options) {
      const result = await engine.syncNow(options);
      result.backup = await backup.refreshIfDue();
      return result;
    },

    async status() {
      let paired = false;
      try { await pairing.link(); paired = true; } catch (e) { /* not paired */ }
      const [desktop, range, ack, lastSyncAt, needsFullCopy, counts, reviewOpen, localChanges] = await Promise.all([
        db.getMeta('desktop'), db.getMeta('range'), db.getMeta('ack', 0), db.getMeta('lastSyncAt'),
        db.getMeta('needsFullCopy', false), records.counts(), review.count(), records.localChanges()
      ]);
      return { phoneId: identity.phoneId, paired, desktopName: desktop ? desktop.name : null, range, ack, lastSyncAt, needsFullCopy, counts, reviewOpen, pendingCount: localChanges.changes.length };
    }
  };
}
