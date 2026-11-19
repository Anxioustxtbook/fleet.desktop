/* Step 2: the navigation. The tab bar, the Add sheet, the Menu groups, swipes, and the back history. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ADD_TILES, HISTORY_MAX, LABELS, MENU_GROUPS, MOTION, SWIPE, TABS, carsLine, isSwipe, popHistory, pushHistory, swipeAction, swipeDirection } from '../src/ui/nav.js';
import { ICON_PATHS } from '../src/ui/iconPaths.js';
import { MENU, MENU_ADMIN, MENU_TOOLS } from '../src/ui/logic.js';
import { FORMS, ADD_BUTTONS } from '../src/ui/forms.js';

const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

test('the tab bar: Home, Rentals, the + button, Calendar, Menu', () => {
  assert.deepEqual(TABS.map(t => [t.id, t.icon, t.label]), [['home', 'home', 'Home'], ['rentals', 'key', 'Rentals'], ['calendar', 'cal', 'Calendar']]);
  const shell = read('../src/ui/Shell.js');
  const order = ['tab(TABS[0])', 'tab(TABS[1])', 'openSheet(\'add\')', 'tab(TABS[2])', 'openSheet(\'menu\')'].map(x => shell.indexOf(x));
  assert.ok(order.every(i => i > 0) && order.every((v, i) => !i || v > order[i - 1]), 'in that order');
  assert.match(shell, /color = t\.name === 'dark' \? '#FFFFFF' : '#000000'/);
  assert.match(shell, /ref=\{targetRef\(tb\.id\)\}/);
  assert.match(shell, /<T size=\{42\} weight="700" tone="onfab"[^>]*>\+<\/T>/);
});

test('the Add sheet has the prototype\'s nine tiles, the first one highlighted, each opening an existing form', () => {
  assert.deepEqual(ADD_TILES.map(x => x.label), ['New rental', 'Payment', 'Booking', 'Expense', 'Client', 'Vehicle', 'Driver', 'Fuel fill', 'Fuel top-up']);
  for (const tile of ADD_TILES) { assert.ok(FORMS[tile.request.form], tile.label); assert.ok(ICON_PATHS[tile.icon], tile.icon); }
  assert.deepEqual(ADD_TILES[7].request, ADD_BUTTONS.fuel[0].preset ? { form: ADD_BUTTONS.fuel[0].form, preset: ADD_BUTTONS.fuel[0].preset } : null);
  assert.deepEqual(ADD_TILES[8].request, { form: 'fuelTopup' });
  assert.match(read('../src/ui/Shell.js'), /Icon name="plus" size=\{20\}/);
});

test('menu and Add sheets expand by dragging, and expanded Add exposes phone-only quick notes', () => {
  const shell = read('../src/ui/Shell.js'), kit = read('../src/ui/kit.js'), prefs = read('../src/localPrefs.js');
  assert.match(shell, /visible=\{s\.sheet === 'menu'\} onClose=\{s\.closeSheet\} draggable/);
  assert.match(kit, /onPanResponderMove/);
  assert.match(shell, /Swipe up to reveal quick notes/);
  assert.match(shell, /<T size=\{16\} weight="700">Quick notes<\/T>/);
  assert.match(shell, /value=\{look\.prefs\.notes \|\| ''\}/);
  assert.match(shell, /onChangeText=\{look\.setNotes\}/);
  assert.match(prefs, /notes: typeof r\.notes === 'string'/);
});

test('the Menu: five groups with the prototype\'s names, tiles and order', () => {
  assert.deepEqual(MENU_GROUPS.map(g => g.title), ['Fleet', 'Operations', 'Money', 'Insights', 'Office computer']);
  assert.deepEqual(MENU_GROUPS.map(g => g.items.map(i => i[1])), [
    ['Vehicles', 'Drivers', 'Clients'], ['Bookings', 'Calendar', 'Rentals', 'Sub-hire'], ['Payments', 'Expenses', 'Fuel', 'Coop'],
    ['Performance', 'Reports', 'Audit', 'Pilot'], ['Connect', 'Review list', 'File & backup']]);
  for (const g of MENU_GROUPS) for (const [icon, label, id] of g.items) { assert.ok(ICON_PATHS[icon], icon); assert.ok(LABELS[id], id); }
});

test('every Menu tile opens a screen the app knows (or one that is on the way)', () => {
  const known = new Set([...MENU, ...MENU_ADMIN, ...MENU_TOOLS].map(m => m.id));
  const onTheWay = new Set(['files']);
  for (const g of MENU_GROUPS) for (const [, label, id] of g.items) assert.ok(known.has(id) || onTheWay.has(id), `${label} -> ${id}`);
  const app = read('../App.js');
  assert.ok(/home: Home,/.test(app), 'Home opens the new Home (Step 3)');
  assert.ok(/calendar: Calendar/.test(app), 'Calendar opens its implemented screen');
  assert.ok(/deskdash: Dashboard/.test(app), 'Home swipe opens the completed Full dashboard');
});

test('swipes: which screen each one goes to (the prototype\'s map)', () => {
  assert.deepEqual(swipeAction('home', 'r'), { type: 'go', id: 'deskdash' });
  assert.deepEqual(swipeAction('home', 'l'), { type: 'go', id: 'rentals' });
  assert.deepEqual(swipeAction('deskdash', 'l'), { type: 'go', id: 'home', noHistory: true });
  assert.deepEqual(swipeAction('deskdash', 'r'), { type: 'none' });
  assert.deepEqual(swipeAction('rentals', 'r'), { type: 'go', id: 'home', noHistory: true });
  assert.deepEqual(swipeAction('rentals', 'l'), { type: 'go', id: 'calendar' });
  assert.deepEqual(swipeAction('calendar', 'r'), { type: 'go', id: 'rentals' });
  assert.deepEqual(swipeAction('calendar', 'l'), { type: 'menu' });
  assert.deepEqual(swipeAction('vehicles', 'r'), { type: 'back' });
  assert.deepEqual(swipeAction('vehicles', 'l'), { type: 'none' });
  assert.deepEqual(swipeAction('vehicles', 'r', { pageOpen: true }), { type: 'back-page' });
  assert.deepEqual(swipeAction('home', 'l', { pageOpen: true }), { type: 'none' });
  assert.deepEqual(swipeAction('home', 'l', { sheetOpen: true }), { type: 'none' });
});

test('what counts as a swipe: 70 across, clearly more across than down, within 0.8 s', () => {
  assert.deepEqual(SWIPE, { minDx: 70, ratio: 1.6, maxMs: 800 });
  assert.ok(isSwipe(90, 10, 300)); assert.ok(isSwipe(-90, 10, 300));
  assert.ok(!isSwipe(60, 0, 300)); assert.ok(!isSwipe(100, 80, 300)); assert.ok(!isSwipe(100, 10, 900));
  assert.equal(swipeDirection(50), 'r'); assert.equal(swipeDirection(-50), 'l');
});

test('the back history keeps the last 30 screens, never repeats the same one, and ends at Home', () => {
  let h = [];
  h = pushHistory(h, 'home', 'rentals'); h = pushHistory(h, 'rentals', 'rentals'); h = pushHistory(h, 'rentals', 'calendar', true);
  assert.deepEqual(h, ['home']);
  const out = popHistory(h); assert.deepEqual([out.screen, out.history], ['home', []]);
  assert.equal(popHistory([]).screen, 'home');
  let long = []; for (let i = 0; i < 40; i++) long = pushHistory(long, 's' + i, 's' + (i + 1));
  assert.equal(long.length, HISTORY_MAX); assert.equal(long[long.length - 1], 's39'); assert.equal(long[0], 's10');
});

test('the line under the name, and the motion numbers from the prototype', () => {
  assert.equal(carsLine(8), '8 cars · Admin'); assert.equal(carsLine(1), '1 car · Admin'); assert.equal(carsLine(undefined), '0 cars · Admin');
  assert.deepEqual([MOTION.screenIn, MOTION.screenRise, MOTION.pageIn, MOTION.pageOut, MOTION.pageSlide, MOTION.sheetUp, MOTION.addReveal], [260, 8, 220, 150, 36, 260, 500]);
});

test('the old drawer and the old bottom status bar are gone from the frame', () => {
  const shell = read('../src/ui/Shell.js');
  assert.ok(!/Drawer|StatusBarBottom|MENU_ADMIN|MENU_TOOLS|Open the menu/.test(shell));
  assert.ok(/BackLink/.test(shell) && /PageHost/.test(shell) && /MenuSheet/.test(shell) && /AddSheet/.test(shell));
});

test('the Account page and what it opens', () => {
  const pages = read('../src/ui/Pages.js');
  for (const row of ['Profile', 'Notifications', 'Settings', 'Support', 'Terms of Use', 'Privacy Policy', 'About', 'App version']) assert.ok(pages.includes(`title="${row}"`), row);
  assert.ok(/jirani system · FleetPilot/.test(pages));
  assert.ok(/Default 0\.80/.test(pages) && /Reset to default/.test(pages));
  const legal = JSON.parse(read('../src/ui/legalTexts.json'));
  assert.equal(legal.terms.sections.length, 8); assert.equal(legal.privacy.sections.length, 8);
});

test('hardware Back: sheet first, then the page, then the screens, and Home leaves the app', () => {
  const s = read('../src/ui/session.js');
  const i = [s.indexOf('if (sheet)'), s.indexOf('if (pages.length)'), s.indexOf("if (screen === 'analysis')"), s.indexOf("if (screen !== 'home')")];
  assert.ok(i.every(x => x > 0) && i.every((v, k) => !k || v > i[k - 1]));
});
