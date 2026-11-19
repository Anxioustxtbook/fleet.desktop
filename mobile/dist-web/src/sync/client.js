/* Talking to the desktop: plain HTTP + JSON on the local network (SYNC_SPEC.md).
   Every failure becomes an FpError whose `message` is in plain words and can be shown as it is. */

import { FpError } from '../util.js';
import { HELLO_TIMEOUT_MS, REQUEST_TIMEOUT_MS } from '../config.js';

const UNREACHABLE = 'The phone cannot reach the computer. Check that both are on the same network and that FleetPilot is open on the computer.';

export function createClient({ fetchFn, timeoutMs = REQUEST_TIMEOUT_MS }) {
  async function call(address, method, path, body, auth, limitMs) {
    const abort = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = abort ? setTimeout(() => abort.abort(), limitMs || timeoutMs) : null;
    try {
      let res;
      try {
        res = await fetchFn(`http://${address}${path}`, {
          method,
          headers: { 'content-type': 'application/json', ...(auth ? { 'x-fp-device': auth.device, 'x-fp-token': auth.token } : {}) },
          body: method === 'GET' ? undefined : JSON.stringify(body || {}),
          signal: abort ? abort.signal : undefined
        });
      } catch (e) {
        throw new FpError('unreachable', UNREACHABLE, { help: 'connect', cause: String((e && e.message) || e) });
      }
      let json;
      try { json = await res.json(); }
      catch (e) { throw new FpError('bad-reply', 'The computer sent a reply the phone could not read. Update both apps and try again.', { status: res.status }); }
      if (!res.ok || json.ok === false) {
        throw new FpError(json.error || 'error', json.message || 'The computer did not accept the request.', { ...json, status: res.status });
      }
      return json;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return {
    hello: address => call(address, 'GET', '/fp/hello', null, null, HELLO_TIMEOUT_MS),
    get: (address, path, auth) => call(address, 'GET', path, null, auth),
    post: (address, path, body, auth) => call(address, 'POST', path, body, auth)
  };
}
