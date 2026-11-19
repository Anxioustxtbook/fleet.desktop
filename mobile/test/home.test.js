/* Step 3: Home. The figures, the attention rules, the sync pill, money words, and the Home tour. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildHome, greeting } from '../src/ui/homeData.js';
import { buildAttention, overdueRentals } from '../src/ui/attention.js';
import { syncPill, daysSince } from '../src/ui/syncState.js';
import { kshShort, ksh0 } from '../src/ui/money.js';
import { TOUR } from '../src/ui/tourSteps.js';
import { cleanPrefs } from '../src/localPrefs.js';
import { buildOverview } from '../src/ui/overview.js';
import { fuelPosition } from '../src/shared/fuelAccount.js';

const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const TODAY = '2026-11-15';
const data = () => ({
  vehicles: [{ id: 1, reg: 'KDK 482T', model: 'Prado', status: 'Rented' }, { id: 2, reg: 'KDL 020A', model: 'Axio', status: 'Rented' }, { id: 3, reg: 'KDG 117M', model: 'Vitz', status: 'Available' }, { id: 4, reg: 'OLD 001A', model: 'Old', status: 'Inactive' }],
  clients: [{ id: 10, name: 'Ndege Tours' }, { id: 11, name: 'Ali Abdi' }, { id: 12, name: 'Faith Achieng' }],
  drivers: [],
  rentals: [
    { id: 100, vehicleId: 1, clientId: 10, pickup: '2026-11-10', return: '2026-11-14', amount: 20000, days: 4, status: 'Active' },     // late, owes 20000
    { id: 101, vehicleId: 2, clientId: 11, pickup: '2026-11-12', return: '2026-11-15', amount: 7500, days: 3, status: 'Active' },      // due today, owes 7500
    { id: 102, vehicleId: 3, clientId: 12, pickup: '2026-11-02', return: '2026-11-05', amount: 9000, days: 3, status: 'Completed' },   // paid in full
    { id: 103, vehicleId: 3, clientId: 12, pickup: '2026-10-20', return: '2026-10-22', amount: 5000, days: 2, status: 'Cancelled' }    // ignored
  ],
  payments: [{ id: 200, rentalId: 102, amount: 9000, date: '2026-11-06', method: 'M-Pesa' }, { id: 201, rentalId: 101, amount: 2500, date: '2026-11-13', method: 'Cash' }],
  expenses: [{ id: 300, category: 'Fuel', vehicleId: 1, amount: 3000, date: '2026-11-11', account: 'Ola' }, { id: 301, category: 'Fuel', vehicleId: 2, amount: 1000, date: '2026-11-12' }, { id: 302, category: 'Parking', vehicleId: 1, amount: 500, date: '2026-11-12' }],
  fuelAccount: [{ id: 400, kind: 'topup', amount: 1000, date: '2026-11-01' }],
  bookings: [{ id: 500, vehicleId: 3, clientId: 12, pickup: '2026-11-16', pickupTime: '09:00', return: '2026-11-19', deposit: 5000, status: 'Pending' }, { id: 501, vehicleId: 3, clientId: 10, pickup: '2026-11-30', return: '2026-12-02', status: 'Confirmed' }, { id: 502, vehicleId: 3, clientId: 10, pickup: '2026-11-17', return: '2026-11-18', status: 'Cancelled' }],
  insurance: [{ id: 600, vehicleId: 1, expiryDate: '2026-11-21' }, { id: 601, vehicleId: 4, expiryDate: '2026-11-01' }]
});

test('money: whole shillings in rows, short forms on cards (the prototype\'s)', () => {
  assert.equal(ksh0(3084000), 'KSh 3,084,000'); assert.equal(ksh0(-650), '-KSh 650');
  assert.equal(kshShort(415000), 'KSh 415K'); assert.equal(kshShort(1110000), 'KSh 1.11M'); assert.equal(kshShort(17600), 'KSh 17.6K');
  assert.equal(kshShort(-12400), '-KSh 12.4K'); assert.equal(kshShort(2000000), 'KSh 2M'); assert.equal(kshShort(950), 'KSh 950'); assert.equal(kshShort(0), 'KSh 0');
});

test('Home hero: the same billed and spent as the Pilot overview, received from this month\'s payments', () => {
  const d = data(), h = buildHome(d, TODAY).hero, m = buildOverview(d, new Date(TODAY + 'T12:00:00Z')).months.find(x => x.month === '2026-11');
  assert.equal(h.label, 'November 2026'); assert.equal(h.billed, m.billed); assert.equal(h.spent, m.spent); assert.equal(h.rentals, 3);
  assert.equal(h.billed, 36500); assert.equal(h.received, 11500); assert.equal(h.net, h.billed - h.spent);
});

test('Home stat cards: fleet in use, owed, fuel this month, fuel account', () => {
  const s = buildHome(data(), TODAY).stats;
  assert.deepEqual(s.fleet, { out: 2, total: 3, available: 1, pct: 67 });          // the inactive car is not in the fleet
  assert.deepEqual(s.owed, { total: 25000, rentals: 2 });                          // cancelled rental ignored, part payment counted
  assert.equal(s.fuelMonth, 4000); assert.equal(s.fuelBalance, fuelPosition(data()).balance); assert.equal(s.fuelBalance, -2000);
});

test('Overdue payments: unpaid rentals whose return date has passed, worst first', () => {
  const o = buildHome(data(), TODAY).overdue;
  assert.equal(o.count, 1); assert.equal(o.total, 20000); assert.equal(o.oldest, 1); assert.equal(o.list[0].reg, 'KDK 482T');
  assert.equal(overdueRentals(data(), '2026-11-20').length, 2);
});

test('Out now: late, today and later badges, with what is owed', () => {
  const out = buildHome(data(), TODAY).out;
  assert.deepEqual(out.map(o => [o.reg, o.badge.text, o.badge.kind, o.owed]), [['KDK 482T', 'Late', 'bad', 20000], ['KDL 020A', 'Today', 'am', 5000]]);
});

test('Next 7 days: pickups from bookings and returns, cancelled and far ones left out', () => {
  const n = buildHome(data(), TODAY).next7;
  assert.deepEqual(n.map(e => [e.kind, e.reg, e.when]), [['Return', 'KDL 020A', 'Today · 15 Nov'], ['Pickup', 'KDG 117M', 'Tomorrow · 16 Nov']]);
  assert.equal(n[1].pending, true); assert.equal(n[1].time, '09:00'); assert.equal(n[1].deposit, 5000);
});

test('Latest payments: money in and money out together, newest first, each tagged', () => {
  const p = buildHome(data(), TODAY).payments;
  assert.deepEqual(p.map(x => [x.key, x.kind]), [['p201', 'in'], ['x302', 'out'], ['x301', 'out'], ['x300', 'out'], ['p200', 'in']]);
  assert.equal(p[0].title, 'Ali Abdi'); assert.equal(p[0].sub, 'Rental KDL 020A · 13 Nov · Cash'); assert.equal(p[0].amount, 2500);
  assert.equal(p[1].title, 'Parking · KDK 482T'); assert.equal(p[1].amount, -500);
  assert.ok(p.every(x => (x.kind === 'in') === (x.amount > 0)));
  assert.ok(/Money out/.test(read('../src/ui/screens/Home.js')) && /Money in/.test(read('../src/ui/screens/Home.js')));
});

test('By car: this month, net = billed - fuel - other, with an All cars total', () => {
  const b = buildHome(data(), TODAY).byCar;
  assert.equal(b.cars.length, 3);
  for (const c of b.cars) assert.equal(Math.round((c.billed - c.fuel - c.other - c.net) * 100), 0);
  assert.equal(b.total.billed, 36500); assert.equal(b.total.rentals, 3);
  assert.equal(b.total.net, Math.round(b.cars.reduce((s, c) => s + c.net, 0) * 100) / 100);
});

test('Needs attention: the rules, levels, counts and the top three', () => {
  const a = buildAttention(data(), TODAY), by = t => a.items.find(x => x.t === t);
  assert.equal(by('Late return').n, 1); assert.equal(by('Late return').lv, 'r');
  assert.equal(by('Unpaid rentals').n, 1); assert.equal(by('Ola balance is negative').lv, 'r');
  assert.equal(by('Due back today').n, 1); assert.equal(by('Bookings still pending').s, 'Next pickup tomorrow: KDG 117M');
  assert.equal(by('Insurance due').s, 'KDK 482T in 6 days');                       // the inactive car's policy is ignored
  assert.equal(by('Fuel fills with no account').lv, 'b');
  assert.equal(a.total, a.items.reduce((s, x) => s + x.n, 0));
  assert.equal(a.top, '1 late return · 1 unpaid rentals · 1 ola balance is negative');
  assert.equal(buildAttention({ rentals: [], bookings: [], expenses: [], fuelAccount: [], insurance: [], vehicles: [], clients: [], payments: [] }, TODAY).total, 0);
});

test('the sync pill: Synced, or Not synced with a red dot (records waiting, a week without a sync, never synced)', () => {
  const now = new Date('2026-11-15T12:00:00Z'), on = { tone: 'on', text: 'Connected to OFFICE' };
  assert.equal(syncPill({ bar: on, paired: true, lastSyncAt: '2026-11-14T09:00:00Z', waiting: 0, now }).label, 'Synced');
  assert.equal(syncPill({ bar: on, paired: true, lastSyncAt: '2026-11-14T09:00:00Z', waiting: 0, now }).red, false);
  const w = syncPill({ bar: on, paired: true, lastSyncAt: '2026-11-14T09:00:00Z', waiting: 3, now });
  assert.deepEqual([w.label, w.red], ['Not synced', true]); assert.match(w.a11y, /3 records waiting/);
  assert.equal(syncPill({ bar: on, paired: true, lastSyncAt: '2026-11-07T09:00:00Z', waiting: 0, now }).label, 'Not synced');
  assert.equal(syncPill({ bar: on, paired: true, lastSyncAt: '2026-11-09T09:00:00Z', waiting: 0, now }).label, 'Synced');      // 6 days is still fine
  assert.equal(syncPill({ bar: { tone: 'off' }, paired: false, lastSyncAt: null, waiting: 0, now }).label, 'Not synced');
  assert.equal(syncPill({ bar: { tone: 'sy', text: 'Syncing...' }, paired: true, lastSyncAt: null, now }).label, 'Syncing');
  assert.equal(daysSince(null), null);
});

test('records waiting are counted from the existing change log, without touching src/sync or src/db', () => {
  const src = read('../src/ui/syncState.js'); assert.ok(/localChanges\(\)/.test(src));
});

test('the Home tour introduces the main tabs, Add and the swipe to Full dashboard', () => {
  assert.deepEqual(TOUR.map(s => s.target), ['home', 'rentals', 'fab', 'calendar', 'menu', 'hero']);
  assert.match(TOUR[0].body, /swipe right.*full dashboard/i);
  assert.match(TOUR[5].body, /swipe right from Home.*full dashboard/i);
  assert.match(read('../src/ui/Tour.js'), /label=\{last \? 'Try the swipe' : 'Next'\}/);
  for (const f of ['../src/ui/Shell.js', '../src/ui/screens/Home.js', '../src/ui/Pages.js']) assert.ok(!/QuickGuide|Quick guide|tipShow/.test(read(f)), f);
  const shell = read('../src/ui/Shell.js');
  for (const n of ["targetRef(tb.id)", "targetRef('fab')", "targetRef('menu')", '<Tour onDone={endTour}']) assert.ok(shell.includes(n), n);
  const home = read('../src/ui/screens/Home.js'); assert.ok(home.includes("targetRef('hero')"));
});

test('the tour is shown once: the choice is kept on the phone only, with the other settings', () => {
  assert.equal(cleanPrefs(null).tourDone, false); assert.equal(cleanPrefs({ tourDone: true }).tourDone, true); assert.equal(cleanPrefs({ tourDone: 'yes' }).tourDone, false);
  assert.equal(cleanPrefs(null).notes, ''); assert.equal(cleanPrefs({ notes: 'Check the booking' }).notes, 'Check the booking');
  assert.equal(cleanPrefs({ notes: 42 }).notes, ''); assert.equal(cleanPrefs({ notes: 'x'.repeat(2100) }).notes.length, 2000);
  assert.equal(cleanPrefs(null).floatingAddEnabled, true); assert.equal(cleanPrefs({ floatingAddEnabled: false }).floatingAddEnabled, false);
  assert.equal(cleanPrefs({ floatingAddCorner: 'top-left' }).floatingAddCorner, 'top-left');
  assert.equal(cleanPrefs({ floatingAddCorner: 'middle' }).floatingAddCorner, 'bottom-right');
  assert.ok(/setTourDone/.test(read('../src/ui/look.js')));
  assert.ok(/setNotes/.test(read('../src/ui/look.js')));
  assert.ok(/Replay the quick tour/.test(read('../src/ui/Pages.js')));
});

test('Home has every section in the prototype\'s order, and the old Dashboard card is gone from Home', () => {
  const src = read('../src/ui/screens/Home.js');
  const order = ['<Hero', 'QUICK.map', 'label="Fleet in use"', 'label="Owed to us"', 'label="Fuel spent"', 'label="Ola balance"', '<AlertCard', 'title="Overdue payments"', 'title="Out now', 'title="Next 7 days"', 'title="Latest payments"', '<ByCar'].map(x => src.indexOf(x));
  assert.ok(order.every(i => i > 0) && order.every((v, i) => !i || v > order[i - 1]), order.join(','));
  assert.ok(/ViewButton/.test(src) && /Full list/.test(read('../src/ui/kit.js')));
  assert.equal(greeting(new Date('2026-11-15T08:00:00')), 'Good morning'); assert.equal(greeting(new Date('2026-11-15T15:00:00')), 'Good afternoon'); assert.equal(greeting(new Date('2026-11-15T20:00:00')), 'Good evening');
});
