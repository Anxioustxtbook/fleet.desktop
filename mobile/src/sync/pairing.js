/* Pairing with the desktop, and finding it again later.

   - The QR code on the desktop holds JSON: { fp, d (desktop id), n (name), a (addresses), p (PIN), db }.
     If the camera is denied, the owner types the address and PIN instead: both end up in pair().
   - A wrong PIN never locks anything: pair() throws bad-pin with tryAgain, and the owner types the PIN again.
   - The token the desktop hands over is shown once; it is kept in the phone's secure store, never in the database
     (so it cannot end up in a backup file).
   - If the computer's address changed, rediscover() asks the network with a UDP broadcast. */

import { FpError, iso, sleep } from '../util.js';
import { APP_VERSION, DISCOVERY_PORT, PAIR_POLL_MS, PAIR_WAIT_MS, PROTOCOL } from '../config.js';
import { metaSet } from '../db/database.js';

const TOKEN_KEY = 'fp.token';

/* the first of several attempts to succeed (Promise.any is not in every phone engine) */
function firstSuccess(promises) {
  return new Promise((resolve, reject) => {
    const errors = [];
    if (!promises.length) return reject(new FpError('unreachable', 'No address to try.'));
    promises.forEach(p => p.then(resolve, e => { errors.push(e); if (errors.length === promises.length) reject(errors); }));
  });
}

export function parseQr(text) {
  let j;
  try { j = JSON.parse(String(text)); } catch (e) { j = null; }
  if (!j || j.fp !== 1 || !Array.isArray(j.a) || !j.a.length || !j.p)
    throw new FpError('bad-qr', 'This is not a FleetPilot QR code. Open Connect phone on the computer and scan the code shown there.');
  return { desktopId: j.d || null, name: j.n || 'the computer', addresses: j.a.map(String), pin: String(j.p), db: j.db || '' };
}

export function createPairing({ db, identity, client, platform, now }) {
  async function findDesktop(addresses, expectedId = null) {
    const unique = [...new Set((addresses || []).filter(Boolean))];
    const tries = unique.map(address => client.hello(address).then(hello => {
      if (expectedId && hello.desktopId !== expectedId)
        throw new FpError('wrong-desktop', 'A different computer answered at that address. Scan the QR code on the right computer.');
      return { address, hello };
    }));
    try { return await firstSuccess(tries); }
    catch (errors) {
      const wrong = Array.isArray(errors) && errors.find(e => e && e.code === 'wrong-desktop');
      throw wrong || (Array.isArray(errors) && errors[0]) || errors;
    }
  }

  async function rediscover(desktopId) {
    if (!platform.udp) return [];
    const found = await platform.udp.broadcast(`FPDISCOVER ${desktopId || ''}`.trim(), platform.discoveryPort || DISCOVERY_PORT, 1500);
    return (found || []).map(String);
  }

  const api = {
    findDesktop,
    rediscover,

    /* what the phone needs to talk to the computer: its saved details and the secret token */
    async link() {
      const desktop = await db.getMeta('desktop');
      const token = await platform.secure.get(TOKEN_KEY);
      if (!desktop || !token) throw new FpError('not-paired', 'This phone is not paired with a computer yet.');
      return { desktop, auth: { device: identity.phoneId, token } };
    },

    /* a working address for the computer: the saved ones first, then a search of the network */
    async reach(link) {
      try {
        return (await findDesktop(link.desktop.addresses, link.desktop.id)).address;
      } catch (e) {
        if (e.code === 'wrong-desktop') throw e;
        const found = await rediscover(link.desktop.id);
        if (!found.length) throw e;
        const hit = await findDesktop(found, link.desktop.id);
        await db.setMeta('desktop', { ...link.desktop, addresses: [...new Set([hit.address, ...found, ...link.desktop.addresses])] });
        return hit.address;
      }
    },

    /* Pair once. Wait for the owner to approve on the computer. */
    async pair({ addresses, pin, desktopId = null, onWaiting = () => {}, protocol = PROTOCOL }) {
      const found = await findDesktop(addresses, desktopId);
      const sent = await client.post(found.address, '/fp/pair', {
        pin: String(pin || ''), name: platform.deviceName(), phoneId: identity.phoneId, instance: identity.instance,
        phoneTime: iso(now()), appVersion: APP_VERSION, protocol
      });                                                                       // a wrong PIN throws bad-pin (tryAgain)

      const giveUp = Date.now() + PAIR_WAIT_MS;
      for (;;) {
        const st = await client.get(found.address, `/fp/pair/status?id=${encodeURIComponent(sent.pairingId)}`);
        if (st.status === 'rejected')
          throw new FpError('rejected', 'The owner did not approve this phone on the computer.');
        if (st.status === 'approved') {
          if (!st.token)
            throw new FpError('token-lost', 'The computer already handed over this phone\'s key, but the phone did not save it. Start pairing again.');
          await platform.secure.set(TOKEN_KEY, st.token);
          const desktop = { id: st.desktopId, name: found.hello.name, db: st.db, addresses: [...new Set([found.address, ...addresses])] };
          await db.write(async q => {
            await metaSet(q, 'desktop', desktop);
            await metaSet(q, 'range', st.range);
            await metaSet(q, 'nextId', st.range.start);
            await metaSet(q, 'ack', 0);
            await metaSet(q, 'needsFullCopy', true);
            await metaSet(q, 'copyStarted', false);                           // a new pairing starts a new first copy
          });
          return { desktop, range: st.range };
        }
        onWaiting({ clock: !!st.clock });                                      // clock: the owner is being asked which clock is right
        if (Date.now() > giveUp) throw new FpError('pair-timeout', 'The computer was not answered in time. Start pairing again.');
        await sleep(platform.pairPollMs != null ? platform.pairPollMs : PAIR_POLL_MS);
      }
    },

    /* forget the computer on this phone (records stay) */
    async unpair() {
      await platform.secure.remove(TOKEN_KEY);
      await db.write(async q => {
        await q.run(`DELETE FROM meta WHERE key IN ('desktop', 'session')`);
      });
    }
  };
  return api;
}
