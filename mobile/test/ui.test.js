/* The rules behind the screens (src/ui/logic.js, theme.js): no phone and no React needed.
   With FP_DESKTOP set, the menu order, the colours and the help text are also compared with the desktop's own files,
   so "same as the desktop" is checked, not assumed. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DESKTOP } from './helpers.js';
import {
  MENU, MENU_ADMIN, MENU_TOOLS, SCREEN_LABEL, ACTION_LABEL, barState, canSync, lastSyncText, phoneWording, phoneHelp,
  reviewActions, totalsLines, editableFields, buildPatch, itemTitle, recordName
} from '../src/ui/logic.js';
import { LIGHT, DARK, BAR, paletteFor } from '../src/ui/theme.js';
import rawHelp from '../src/ui/connectHelp.json' with { type: 'json' };

const skip = DESKTOP ? false : 'set FP_DESKTOP to the desktop project folder to compare with the desktop';
const desktopHtml = () => fs.readFileSync(path.join(DESKTOP, 'index.html'), 'utf8');

/* ---------- same as the desktop ---------- */
test('the screen directory keeps the desktop\'s order and names (the Menu sheet groups the same screens differently, see nav.test.js)', { skip }, () => {
  const html = desktopHtml();
  const start = html.indexOf('<div class="nav" id="nav">');
  const end = html.indexOf('<div class="filebox">', start);
  const found = [];
  for (const line of html.slice(start, end).split('\n')) {
    const m = line.match(/<button data-panel="([a-z]+)"(?: class="active")?>.*?<span class="label-txt">([^<]*)<\/span>.*<\/button>/);   // some entries carry a small badge after the name
    if (m) found.push([m[1], m[2].trim()]);
  }
  const mine = [...MENU, ...MENU_ADMIN].map(m => m.id === 'audit' ? ['analysis', 'Analysis'] : [m.id, m.label]);   // the one deliberate difference: the phone's Audit stands where the desktop has Analysis, and Analysis is a button inside it
  assert.deepEqual(mine, found);
});

test('the colours are the new look\'s (the locked prototype in docs/reference), light and dark', () => {
  /* Step 1 replaced the desktop's old palette with the prototype's. The reference file is now the source of truth. */
  const html = fs.readFileSync(new URL('../docs/reference/FleetPilot_Phone_v5_Jirani_Updated-1.html', import.meta.url), 'utf8');
  const block = re => Object.fromEntries([...re.exec(html)[1].matchAll(/--([a-z0-9]+):\s*([^;}]+)/g)].map(m => [m[1], m[2].trim()]));
  const norm = v => String(v).toLowerCase().replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/, '#$1$1$2$2$3$3').replace(/\s+/g, '').replace(/\(\./g, '(0.').replace(/,\./g, ',0.');
  const light = block(/:root\{(--bg:[^}]*)\}/), dark = { ...light, ...block(/:root\[data-theme=dark\]\{([^}]*)\}/) };
  const names = ['bg', 'card', 'card2', 'line', 'ink', 'dim', 'gold', 'goldt', 'goldbg', 'green', 'greenbg', 'red', 'redbg', 'blue', 'bluebg', 'orange', 'orangebg', 'onfab', 'warn', 'warnline', 'tab'];
  for (const n of names) {
    assert.equal(norm(LIGHT[n]), norm(light[n]), `light ${n}`);
    assert.equal(norm(DARK[n]), norm(dark[n]), `dark ${n}`);
  }
});

test('the status bar uses the desktop\'s four looks', { skip }, () => {
  const html = fs.readFileSync(path.join(DESKTOP, 'src/connectPhone.js'), 'utf8');
  assert.ok(html.includes('.fpb.on{background:#1f7a4d;color:#fff;}') && html.includes('background:#7dffb5'));
  assert.ok(html.includes('.fpb.ask{background:#b36b00;color:#fff;}') && html.includes('background:#ffd27a'));
  assert.ok(html.includes('.fpb.off{background:#2b3640;color:#cfd8de;}') && html.includes('background:#8a98a3'));
  assert.equal(BAR.on.background.toLowerCase(), '#1f7a4d');
  assert.equal(BAR.ask.background.toLowerCase(), '#b36b00');
  assert.equal(BAR.off.background.toLowerCase(), '#2b3640');
});

test('the guide text is the desktop\'s file, unchanged (one source for both)', { skip }, () => {
  assert.deepEqual(rawHelp, JSON.parse(fs.readFileSync(path.join(DESKTOP, 'src/connectHelp.json'), 'utf8')));
});

/* ---------- menu ---------- */
test('every menu item has a name, a table screen knows its list, and the phone\'s own screens are at the bottom', () => {
  assert.equal(MENU.length, 15);
  assert.ok(MENU.every(m => m.label));
  assert.equal(MENU.find(m => m.id === 'fuel').list, 'fuelAccount');
  assert.equal(MENU.find(m => m.id === 'coop').list, 'coops');
  assert.deepEqual(MENU.filter(m => m.viewOnly).map(m => m.id), ['calendar', 'performance', 'reports']);
  assert.equal(MENU.find(m => m.id === 'audit').label, 'Audit'); assert.ok(!MENU.some(m => m.id === 'analysis'));
  assert.equal(SCREEN_LABEL.analysis, 'Analysis');
  assert.deepEqual(MENU_TOOLS.map(m => m.id), ['connect', 'review']);
  assert.equal(SCREEN_LABEL.connect, 'Connect to desktop');
  assert.equal(new Set(Object.keys(SCREEN_LABEL)).size, MENU.length + MENU_ADMIN.length + MENU_TOOLS.length + 1);   // no id twice
});

test('palettes follow the phone\'s light or dark setting', () => {
  assert.equal(paletteFor('dark'), DARK);
  assert.equal(paletteFor('light'), LIGHT);
  assert.equal(paletteFor(null), LIGHT);
});

/* ---------- status bar ---------- */
test('the status bar says the right thing in every situation', () => {
  const base = { paired: true, desktopName: 'Office PC', needsFullCopy: false, ping: 'connected', busy: null, ask: null };
  assert.deepEqual(barState(base), { tone: 'on', text: 'Connected to Office PC' });
  assert.equal(barState({ ...base, ping: 'unreachable' }).tone, 'off');
  assert.match(barState({ ...base, ping: 'unreachable' }).text, /cannot be reached/);
  assert.deepEqual(barState({ ...base, paired: false }), { tone: 'off', text: 'Not connected to a computer' });
  assert.match(barState({ ...base, needsFullCopy: true }).text, /first copy/);
  assert.deepEqual(barState({ ...base, busy: { text: 'Sending 1 of 3' } }), { tone: 'sy', text: 'Sending 1 of 3' });
  assert.equal(barState({ ...base, ask: 'approval' }).tone, 'ask');
  assert.match(barState({ ...base, ask: 'approval' }).text, /approval/);
  assert.match(barState({ ...base, ask: 'clock' }).text, /Answer the question/);
  assert.equal(barState({ ...base, busy: { text: 'x' }, ask: 'clock' }).tone, 'ask');            // being asked beats being busy
});

test('Sync is only offered when it can work', () => {
  const ok = { paired: true, needsFullCopy: false, busy: null, ask: null };
  assert.equal(canSync(ok), true);
  assert.equal(canSync({ ...ok, paired: false }), false);
  assert.equal(canSync({ ...ok, needsFullCopy: true }), false);
  assert.equal(canSync({ ...ok, busy: { text: 'Syncing...' } }), false);
  assert.equal(canSync({ ...ok, ask: 'clock' }), false);
});

test('the last sync time is shown plainly', () => {
  const now = new Date(2026, 10, 9, 15, 0);
  assert.equal(lastSyncText(null, now), 'Not synced yet');
  assert.equal(lastSyncText('garbage', now), 'Not synced yet');
  assert.equal(lastSyncText(new Date(2026, 10, 9, 14, 5).toISOString(), now), 'Last sync 14:05');
  assert.equal(lastSyncText(new Date(2026, 10, 7, 9, 3).toISOString(), now), 'Last sync 7 Nov 09:03');
});

/* ---------- the guide ---------- */
test('the guide reads right on the phone: no "this window", no "this computer", nothing about "here"', () => {
  const help = phoneHelp(rawHelp);
  assert.equal(help.ways.length, 4);
  assert.deepEqual(help.ways.map(w => w.id), ['router', 'phone-hotspot', 'usb', 'pc-hotspot']);
  const all = JSON.stringify(help);
  assert.ok(!/this computer|this window|shown here/i.test(all), all.match(/.{30}(this computer|this window|shown here).{30}/i));
  assert.equal(phoneWording('This computer needs Wi-Fi.'), 'The computer needs Wi-Fi.');
  assert.equal(phoneWording("on this computer's screen"), "on the computer's screen");
  assert.equal(phoneWording('Close and open this window again'), 'Close and open the Connect phone window on the computer again');
  assert.equal(phoneWording('type the PIN shown here'), 'type the PIN shown on the computer');
  assert.ok(!('noNetwork' in help), 'the computer\'s own "no network" line is not for the phone');
});

/* ---------- the review list ---------- */
test('each kind of review item offers the right actions', () => {
  assert.deepEqual(reviewActions({ kind: 'replaced' }), ['restore', 'edit', 'keep']);
  assert.deepEqual(reviewActions({ kind: 'held' }), ['edit']);
  assert.deepEqual(reviewActions({ kind: 'totals' }), ['seen']);
  for (const k of ['replaced', 'held', 'totals']) for (const a of reviewActions({ kind: k })) assert.ok(ACTION_LABEL[a], a);
});

test('review sentences and totals lines are plain words', () => {
  assert.equal(recordName('rentals', 7), 'Rental 7');
  assert.match(itemTitle({ kind: 'held', list: 'rentals', recId: '1000000005' }), /Waiting for the computer: Rental 1000000005/);
  assert.match(itemTitle({ kind: 'replaced', list: 'vehicles', recId: '3' }), /Your change to Vehicle 3 was replaced/);
  assert.equal(itemTitle({ kind: 'totals', title: 'Totals differ' }), 'Totals differ');
  assert.deepEqual(totalsLines([{ list: 'payments', a: { n: 4, sum: 1500.5 }, b: { n: 3, sum: 1200 } }]),
    ['payments: the computer has 4 (1,500.5), the phone has 3 (1,200)']);
  assert.deepEqual(totalsLines(null), []);
});

/* ---------- editing a record as plain fields ---------- */
test('a record becomes plain fields; details stay locked', () => {
  const f = editableFields({ id: 5, vehicleId: 1, amount: 250.5, note: 'x', paid: false, empty: null, lines: [1, 2], extra: { a: 1 } });
  assert.deepEqual(f.map(x => [x.key, x.kind]), [['vehicleId', 'number'], ['amount', 'number'], ['note', 'text'], ['paid', 'bool'], ['empty', 'text'], ['lines', 'locked'], ['extra', 'locked']]);
  assert.equal(f.find(x => x.key === 'amount').value, '250.5');
  assert.equal(f.find(x => x.key === 'lines').value, '2 items');
  assert.ok(!f.some(x => x.key === 'id'), 'the record number is never edited');
});

test('only what changed is saved, numbers stay numbers, and a bad number is refused with a message', () => {
  const rec = { id: 5, vehicleId: 999, amount: 100, note: 'a', paid: false, lines: [1] };
  assert.deepEqual(buildPatch(rec, { vehicleId: '1' }), { patch: { vehicleId: 1 }, errors: {} });
  assert.deepEqual(buildPatch(rec, { amount: '1,250.50', note: 'a' }).patch, { amount: 1250.5 });             // unchanged note is not in the patch
  assert.deepEqual(buildPatch(rec, { amount: '100' }).patch, {});
  assert.deepEqual(buildPatch(rec, { paid: true }).patch, { paid: true });
  assert.deepEqual(buildPatch(rec, { lines: 'x' }).patch, {});                                              // details are never edited here
  const bad = buildPatch(rec, { amount: 'abc', vehicleId: '' });
  assert.deepEqual(bad.patch, {});
  assert.equal(bad.errors.amount, 'amount must be a number');
  assert.equal(bad.errors.vehicleId, 'vehicleId must be a number');
});

test('skeleton loading: every kind has shapes, a short delay avoids flicker, and the screens use it', async () => {
  const { SHAPES, SKELETON_DELAY_MS, skeletonKinds } = await import('../src/ui/skeletonShapes.js');
  assert.deepEqual(skeletonKinds().sort(), ['calendar', 'cards', 'list', 'report']);
  assert.ok(SKELETON_DELAY_MS > 0 && SKELETON_DELAY_MS < 300);
  for (const k of skeletonKinds()) assert.ok(SHAPES[k].header && (SHAPES[k].row || SHAPES[k].grid), k);
  const fs = await import('node:fs');
  for (const n of ['ListScreen', 'Overdue', 'Pilot', 'Calendar', 'Performance', 'Reports', 'Audit', 'Analysis', 'Connect']) {
    const src = fs.readFileSync(`src/ui/screens/${n}.js`, 'utf8');
    assert.ok(src.includes("import Skeleton from '../Skeleton.js'") && src.includes('<Skeleton kind='), `${n} shows a skeleton while loading`);
  }
});
