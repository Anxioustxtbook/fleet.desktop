/* Step 4: lists, records and forms. Exit / Restore, photos, the overdue page rules, the list helpers, and the form checks. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isExited, exitPatch, restorePatch, confirmText, toastFor, usage, usageText, isRegister } from '../src/ui/lifecycle.js';
import { fitSize, photoKey, cleanPhotos } from '../src/ui/photos.js';
import { buildOverdue, amountMessage, quickAmount, isDuplicate, inBand } from '../src/ui/overdueView.js';
import { buildTable } from '../src/ui/tables.js';
import { sectionsOf, stripsOf } from '../src/ui/listView.js';
import { checkForm, blankValues, NEEDED, FUTURE_MSG } from '../src/ui/forms.js';

const today = '2026-11-16';
const data = {
  vehicles: [{ id: 1, reg: 'KDA 111A', status: 'Available' }, { id: 2, reg: 'KDB 222B', status: 'Inactive' }],
  clients: [{ id: 1, name: 'Amina' }, { id: 2, name: 'Brian', status: 'Exited' }],
  drivers: [{ id: 1, name: 'Joe', status: 'Active' }],
  rentals: [{ id: 10, vehicleId: 1, clientId: 1, pickup: '2026-11-01', return: '2026-11-05', amount: 10000, status: 'Completed' }, { id: 11, vehicleId: 1, clientId: 1, pickup: '2026-11-01', return: '2026-11-14', amount: 4000, status: 'Completed' }],
  payments: [{ id: 1, rentalId: 10, amount: 4000, date: '2026-11-03', method: 'Cash' }], bookings: [], expenses: []
};

test('exit and restore use the right field per list', () => {
  assert.deepEqual(exitPatch('clients'), { status: 'Exited' });
  assert.deepEqual(exitPatch('vehicles'), { status: 'Inactive' });
  assert.deepEqual(restorePatch('vehicles'), { status: 'Available' });
  assert.deepEqual(restorePatch('drivers'), { status: 'Active' });
  assert.ok(isExited('clients', { status: 'Exited' }) && !isExited('clients', { status: 'Active' }) && isExited('vehicles', { status: 'Inactive' }));
  assert.ok(isRegister('vehicles') && !isRegister('rentals'));
});
test('confirm and toast words', () => {
  assert.match(confirmText('delete', 'vehicles', { reg: 'KDA 111A' }).title, /Delete KDA 111A\?/);
  assert.equal(toastFor('exit', 'clients', { name: 'Amina' }), 'Amina marked as exited');
  assert.equal(usageText(usage('vehicles', 1, data)), 'It is used by 2 rentals.');
});
test('registers hide exited rows and count them', () => {
  const cur = buildTable('clients', data, {}), ex = buildTable('clients', data, { showExited: true });
  assert.equal(cur.shown, 1); assert.equal(cur.exitedCount, 1); assert.equal(ex.shown, 1); assert.equal(ex.rows[0].title, 'Brian');
});
test('photos: keys, sizes and clean prefs', () => {
  assert.equal(photoKey('clients', 4), 'clients|4');
  assert.equal(fitSize(1440, 720).width, 720);
  assert.deepEqual(cleanPhotos({ 'a|1': 'file:///x.jpg', bad: 5 }), { 'a|1': 'file:///x.jpg' });
});
test('overdue page: bands, totals and messages', () => {
  const v = buildOverdue(data, today);
  assert.equal(v.rows.length, 2); assert.equal(v.rows[0].id, 10); assert.equal(v.owed, 10000); assert.equal(v.oldest, 11);
  assert.equal(buildOverdue(data, today, { band: '1-7' }).rows.length, 1);
  assert.equal(buildOverdue(data, today, { search: 'nobody' }).rows.length, 0);
  assert.ok(inBand('15+', 20) && !inBand('15+', 14));
  assert.equal(amountMessage('7000', 6000).tone, 'red'); assert.equal(amountMessage('6000', 6000).tone, 'green'); assert.equal(amountMessage('2000', 6000).tone, 'orange');
  assert.equal(quickAmount('half', 6000), '3000');
  assert.ok(isDuplicate(data.payments, 10, 4000, '2026-11-03') && !isDuplicate(data.payments, 10, 4000, '2026-11-04'));
});
test('list helpers: month sections and totals strips', () => {
  const s = sectionsOf([{ header: 'Nov 2026', key: 'h1' }, { key: 'a' }, { key: 'b' }, { header: 'Oct 2026', key: 'h2' }, { key: 'c' }]);
  assert.equal(s.length, 2); assert.equal(s[0].rows.length, 2);
  assert.equal(stripsOf([{ label: 'a', value: 1 }, { label: 'b', value: 2 }, { label: 'c', value: 3 }, { label: 'd', value: 4 }]).length, 1);
});
test('form checks use the shared wording', () => {
  const ctx = { data, today, existing: null, preset: null }, v = { ...blankValues('payments', ctx), rentalId: 10, amount: '9000', date: '2026-12-30' };
  const c = checkForm('payments', v, ctx);
  assert.equal(c.errors.date, FUTURE_MSG); assert.match(c.errors.amount, /more than the KSh 6,000 still owed/);
  assert.equal(checkForm('payments', { ...v, rentalId: '' }, ctx).errors.rentalId, NEEDED);
});
test('screens are wired: list, record page, overdue, no old table', () => {
  const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');
  assert.match(app, /ListScreen/); assert.match(app, /overdue: Overdue/); assert.doesNotMatch(app, /screens\/Table\.js/);
  const form = fs.readFileSync(new URL('../src/ui/screens/EntryForm.js', import.meta.url), 'utf8');
  assert.match(form, /FormPage/); assert.match(form, /Saving/); assert.match(form, /Saved/);
});

/* ---- finishing Step 4: Fuel ledger, Coop table, Full-list columns, coop forms ---- */
import { buildFuel, runningBalance, FUEL_HEAD } from '../src/ui/fuelView.js';
import { buildCoop, COOP_HEAD, coopRow, VAT } from '../src/ui/coopView.js';
import { fullTable } from '../src/ui/listView.js';
import { FORMS, planSave, applyChange } from '../src/ui/forms.js';

const fdata = {
  vehicles: [{ id: 1, reg: 'KDA 111A', model: 'Axio' }], clients: [{ id: 1, name: 'ACME', type: 'coop' }], drivers: [], bookings: [], payments: [],
  rentals: [{ id: 5, vehicleId: 1, clientId: 1, type: 'coop', pickup: '2026-11-02', return: '2026-11-04', days: 3, amount: 9000, fuel: 500, allowance: 300, status: 'Completed', contract: 'JC1' }],
  expenses: [{ id: 1, category: 'Fuel', account: 'Ola', date: '2026-11-03', amount: 2000, vehicleId: 1 }, { id: 2, category: 'Fuel', account: 'Outside', date: '2026-11-04', amount: 700, vehicleId: 1 }, { id: 3, category: 'Fuel', date: '2026-11-05', amount: 400, vehicleId: 1 }],
  fuelAccount: [{ id: 1, kind: 'opening', amount: 1000, date: '' }, { id: 2, kind: 'topup', amount: 5000, date: '2026-11-01' }],
  coops: [{ id: 1, name: 'JOE', department: 'HR', start: '2026-11-02', end: '2026-11-04', days: 3, amount: 9000, kmOut: 100, kmIn: 250, contract: 'JC1', rentalId: 5 }, { id: 2, name: 'ANN', start: '2026-10-10', amount: 4000, rentalId: '' }]
};
test('fuel: month cards, ledger balance, untagged and Show filter', () => {
  const f = buildFuel(fdata, today, { month: '2026-11' });
  assert.equal(f.cards.paidIn, 5000); assert.equal(f.cards.taken, 2000); assert.equal(f.cards.outside, 700); assert.equal(f.cards.balance, 4000); assert.equal(f.cards.opening, 1000);
  assert.equal(f.untagged.count, 1); assert.equal(f.rows.length, 4);
  assert.equal(buildFuel(fdata, today, { month: '2026-11', show: 'Ola' }).rows.length, 1);
  assert.equal(buildFuel(fdata, today, { month: '2026-11', show: 'topups' }).rows[0].balance, 6000);
  assert.equal(runningBalance(fdata).get('expenses|1'), 4000);
  assert.equal(FUEL_HEAD.length, 7); assert.equal(buildFuel(fdata, today, { month: 'all' }).prev, null);
});
test('coop: figures come from the rental; VAT is display only; 16 columns', () => {
  const c = buildCoop(fdata, today, { month: '2026-11' });
  assert.equal(c.lines.length, 1); assert.equal(c.totals.km, 150); assert.equal(c.totals.fuel, 500 + 0); assert.equal(c.totals.total, 9800);
  const v = buildCoop(fdata, today, { month: '2026-11', vat: true });
  assert.equal(v.totals.charge, 10440); assert.equal(v.vatInfo.base, 9000); assert.equal(VAT, 0.16); assert.equal(fdata.coops[0].amount, 9000);
  assert.equal(buildCoop(fdata, today, { month: 'all', line: 'todo' }).lines.length, 1);
  assert.equal(COOP_HEAD.length, 16); assert.equal(coopRow(c.lines[0], String).length, 16);
});
test('full lists: rentals and sub-hire have their own columns and a total row', () => {
  const r = fullTable('rentals', [{ date: '2026-11-02', title: 'A', sub: 'x', amount: 'KSh 100', amountNum: 100, paidNum: 40, owedNum: 60, tag: 'Part paid' }]);
  assert.equal(r.head.length, 7); assert.ok(r.total); assert.equal(r.rows[1][3], 'KSh 100'); assert.equal(r.rows[1][5], 'KSh 60');
  assert.equal(fullTable('payments', []).total, false);
});
test('coop forms: a line from a rental fills from the rental and updates its contract and mileage', () => {
  assert.ok(FORMS.coops && FORMS.coopFromRental);
  const ctx = { data: fdata, today, existing: null, preset: null };
  const v = applyChange('coopFromRental', 'rentalId', 5, {}, ctx, {});
  assert.equal(v.name, 'JOE'); assert.equal(v.contract, 'JC1');
  const plan = planSave('coopFromRental', { ...v, kmOut: '100', kmIn: '300' }, ctx);
  assert.equal(plan.ops[0].op, 'update'); assert.equal(plan.ops[1].list, 'rentals'); assert.equal(plan.ops[1].patch.mileage, 200);
  const z = planSave('coops', { name: 'zed', department: '', start: '2026-11-10', end: '', days: '2', contract: '', amount: '1,000', kmOut: '', kmIn: '' }, ctx);
  assert.equal(z.ops[0].fields.name, 'ZED'); assert.equal(z.ops[0].fields.rentalId, ''); assert.equal(z.ops[0].fields.amount, 1000);
});
