/* A ping to the desktop about every 15 seconds while the app is open, so the green bar on the desktop stays on.
   Start it when the app comes to the front and stop it when the app goes to the background. */

import { PING_MS } from '../config.js';

export function createPinger({ pairing, client, platform, onState = () => {} }) {
  let timer = null, address = null, busy = false, state = 'stopped';

  const set = (next, error) => { if (next !== state) { state = next; onState(next, error); } };

  /* one ping; returns 'connected', 'unreachable', 'not-paired' */
  async function once() {
    if (busy) return state;
    busy = true;
    try {
      const link = await pairing.link();
      if (!address) address = await pairing.reach(link);
      await client.post(address, '/fp/ping', {}, link.auth);
      set('connected');
    } catch (e) {
      address = null;                                                        // look for the computer again next time
      set(e && e.code === 'not-paired' ? 'not-paired' : 'unreachable', e);
    } finally {
      busy = false;
    }
    return state;
  }

  return {
    once,
    start() { if (timer) return; once(); timer = setInterval(once, platform.pingMs != null ? platform.pingMs : PING_MS); },
    stop() { if (timer) clearInterval(timer); timer = null; address = null; set('stopped'); },
    state: () => state
  };
}
