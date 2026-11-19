/* Test stand-ins. src/platform.js (Expo) is swapped for Node pieces that give the app the same shapes:
   a SQLite connection with the expo-sqlite method names, a secure store, a folder, a network.

   Tests that talk to the REAL desktop sync server need the desktop project:
       FP_DESKTOP=/path/to/the/desktop/project  npm test
   Without it those tests are skipped, and the tests that need no desktop still run. */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import dgram from 'node:dgram';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const DESKTOP = process.env.FP_DESKTOP ? path.resolve(process.env.FP_DESKTOP) : null;

export const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fpm-'));

/* a SQLite connection with the same method names as expo-sqlite's database object */
export function nodeOpen(file) {
  const d = new DatabaseSync(file);
  return {
    execAsync: async sql => { d.exec(sql); },
    runAsync: async (sql, params = []) => { const r = d.prepare(sql).run(...params); return { changes: r.changes, lastInsertRowId: Number(r.lastInsertRowid) }; },
    getAllAsync: async (sql, params = []) => d.prepare(sql).all(...params).map(r => ({ ...r })),
    getFirstAsync: async (sql, params = []) => { const r = d.prepare(sql).get(...params); return r ? { ...r } : null; },
    closeAsync: async () => { d.close(); }
  };
}

export function makePlatform(dir, opts = {}) {
  const { fetchFn = (...a) => fetch(...a), clock = () => new Date(), secure = new Map(), discoveryPort, protocol } = opts;
  fs.mkdirSync(dir, { recursive: true });
  const backupDir = path.join(dir, 'developer');
  const awake = { on: 0, off: 0 };
  return {
    awake,
    now: clock,
    fetchFn,
    protocol,
    discoveryPort,
    pairPollMs: 15, clockRetryMs: 25, clockWaitMs: 400, pingMs: 40,        // fast, so tests do not wait

    openDb: async name => nodeOpen(path.join(dir, name)),
    openDbAt: async (folder, name) => nodeOpen(path.join(folder, name)),
    secure: {
      get: async k => (secure.has(k) ? secure.get(k) : null),
      set: async (k, v) => { secure.set(k, v); },
      remove: async k => { secure.delete(k); }
    },
    fs: {
      backupFolder: async () => { fs.mkdirSync(backupDir, { recursive: true }); return backupDir; },
      join: (d, n) => path.join(d, n),
      plainPath: p => p,
      exists: async p => fs.existsSync(p),
      read: async p => fs.readFileSync(p, 'utf8'),
      write: async (p, t) => { fs.writeFileSync(p, t); },
      append: async (p, t) => { fs.appendFileSync(p, t); },
      remove: async p => { fs.rmSync(p, { force: true }); },
      move: async (a, b) => { fs.renameSync(a, b); }
    },
    randomId: n => crypto.randomBytes(n).toString('base64url').replace(/[-_]/g, 'x').slice(0, n),
    deviceName: () => 'Test phone',
    keepAwake: { on: async () => { awake.on++; }, off: async () => { awake.off++; } },
    udp: {
      /* the same job as the phone's broadcast, aimed at this computer so it works in any test machine */
      broadcast: (message, port, waitMs) => new Promise(resolve => {
        const found = new Set(), socket = dgram.createSocket('udp4');
        socket.on('message', data => { try { (JSON.parse(String(data)).a || []).forEach(a => found.add(String(a))); } catch (e) { /* not ours */ } });
        socket.bind(0, () => {
          const out = Buffer.from(message);
          socket.send(out, 0, out.length, port, '127.0.0.1');
          setTimeout(() => { try { socket.close(); } catch (e) { /* closed */ } resolve([...found]); }, waitMs);
        });
      })
    }
  };
}

/* the desktop project's own test kit (real server, real SQLite store, and a simulated phone) */
export function desktopKit() {
  const require = createRequire(import.meta.url);
  return require(path.join(DESKTOP, 'test/phone-sync/helpers.cjs'));
}
export function desktopModule(name) {
  const require = createRequire(import.meta.url);
  return require(path.join(DESKTOP, 'electron', name));
}
export const mobileRoot = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
