/* The entry forms, the Audit, the Analysis and the batch save. No desktop and no phone needed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tmpDir, makePlatform } from './helpers.js';
import { openDatabase, ensureIdentity } from '../src/db/database.js';
import { createRecords } from '../src/db/records.js';
import { parseDate, parseTime, parseMoney, FORMS, choicesOf, checkForm, planSave, blankValues, valuesFromRecord, formIdFor, editBlocked, markPaidPatch, owedOn, recordMonth } from '../src/ui/forms.js';
import { suggestions, matches } from '../src/ui/forms.js';
import { searchHit, buildTable } from '../src/ui/tables.js';
import { buildAudit, rentMissing, rentPreset, auditHeadline } from '../src/ui/audit.js';
import { buildAnalysis } from '../src/ui/analysis.js';

const TODAY = '2026-11-10';
const data = () => ({
  vehicles: [{ id: 1, reg: 'KAA 001A', rate: 5000, ownership: 'own', status: 'Available' }, { id: 2, reg: 'KBB 002B', rate: 6000, ownership: 'subhire', owner: 'Omondi', ownerCost: 3000, status: 'Available' }],
  clients: [{ id: 3, name: 'ACME', type: 'coop' }, { id: 8, name: 'Wanjiru', type: 'walkin' }], drivers: [], bookings: [], coops: [], invoices: [], insurance: [], fuelAccount: [],
  rentals: [
    { id: 4, vehicleId: 1, clientId: 3, pickup: '2026-11-01', return: '2026-11-03', amount: 10000, days: 2, status: 'Active' },
    { id: 6, vehicleId: 2, clientId: 8, pickup: '2026-10-05', return: '2026-10-06', amount: 6000, days: 1, status: 'Completed', subhireCost: 3000, subhirePaid: false }],
  payments: [{ id: 5, rentalId: 4, amount: 4000, date: '2026-11-02' }],
  expenses: [{ id: 7, vehicleId: 1, date: '2026-11-02', amount: 700, category: 'Garage', desc: 'tyre' }]
});
const ctx = (d, extra = {}) => ({ data: d, today: TODAY, existing: null, preset: null, ...extra });

test('dates and times are read loosely, and bad ones are refused', () => {
  assert.equal(parseDate('1011', TODAY), '2026-11-10'); assert.equal(parseDate('10/11', TODAY), '2026-11-10'); assert.equal(parseDate('10/11/26', TODAY), '2026-11-10');
  assert.equal(parseDate('t', TODAY), TODAY); assert.equal(parseDate('y', TODAY), '2026-11-09'); assert.equal(parseDate('31/02', TODAY), ''); assert.equal(parseDate('abc', TODAY), '');
  assert.equal(parseTime('930'), '09:30'); assert.equal(parseTime('2:30pm'), '14:30'); assert.equal(parseTime('25:00'), '');
  assert.equal(parseMoney('KSh 1,500.50'), 1500.5); assert.ok(Number.isNaN(parseMoney('12a')));
});

test('entry forms provide examples for typed fields and pickers', () => {
  const field = (form, key) => FORMS[form].fields.find(item => item.key === key);
  assert.equal(field('vehicles', 'reg').placeholder, 'KBR 670E');
  assert.equal(field('vehicles', 'rate').placeholder, '5,000');
  assert.equal(field('bookings', 'pickup').placeholder, '15/11/2026');
  assert.equal(field('rentals', 'pickupTime').placeholder, '09:00');
  assert.equal(field('payments', 'rentalId').placeholder, 'KBR 670E · Ndege Tours');
  assert.equal(field('expenses', 'desc').placeholder, 'Engine service');
});

test('new expenses retain every existing custom category alongside the standard choices', () => {
  const custom = Array.from({ length: 30 }, (_, index) => `Desktop category ${index + 1}`);
  const options = choicesOf('expenses', FORMS.expenses.fields[0], ctx({ expenses: custom.map(category => ({ category })) }));
  assert.equal(options.length, 41);
  assert.ok(custom.every(category => options.some(option => option.value === category)));
  assert.ok(['Car wash', 'Tyres', 'Insurance'].every(category => options.some(option => option.value === category)));
  const expenseForm = fs.readFileSync(new URL('../src/ui/screens/EntryForm.js', import.meta.url), 'utf8');
  assert.match(expenseForm, /allowCustom=\{form === 'expenses' && f\.key === 'category'\}/);
  assert.match(expenseForm, /placeholder="Or type any expense category"/);
});

test('a payment cannot be more than the rental still owes, and picking the rental fills the amount', () => {
  const d = data(), f = FORMS.payments, v = { ...blankValues('payments', ctx(d)), rentalId: 4, amount: '7000' };
  const bad = checkForm('payments', v, ctx(d)); assert.equal(bad.ok, false); assert.match(bad.errors.amount, /KSh 6,000 still owed/);
  assert.deepEqual(f.onChange('rentalId', { ...v, amount: '' }, ctx(d)), { amount: '6000', __amountFromRental: true });
  const ok = planSave('payments', { ...v, amount: '6000' }, ctx(d)); assert.equal(ok.ops[0].fields.amount, 6000); assert.equal(ok.ops[0].fields.date, TODAY);
  assert.equal(owedOn(d, d.rentals[0]), 6000);
});

test('a new rental: needs a client, works the amount out, makes the car Rented, and writes the fuel line', () => {
  const d = data();
  const v = { ...blankValues('rentals', ctx(d)), vehicleId: 1, newClientName: 'New Person', pickup: '10/11', return: '12/11', rate: '5000', fuel: '1500', fuelCharge: '1500' };
  const chk = checkForm('rentals', v, ctx(d)); assert.ok(chk.ok, JSON.stringify(chk.errors));
  const plan = planSave('rentals', v, ctx(d));
  assert.deepEqual(plan.ops.map(o => o.op + ':' + o.list), ['create:clients', 'create:rentals', 'update:vehicles', 'create:expenses']);
  const res = [{ id: 50 }, { id: 51 }];
  assert.equal(plan.ops[1].fields(res).clientId, 50); assert.equal(plan.ops[3].fields(res).rentalId, 51); assert.equal(plan.ops[1].fields(res).amount, 15000);   // 3 days (10, 11, 12 Nov) x 5000
  assert.equal(checkForm('rentals', { ...v, newClientName: '', clientId: null }, ctx(d)).ok, false);
});

test('a double booking is warned about, not refused', () => {
  const d = data(), v = { ...blankValues('rentals', ctx(d)), vehicleId: 1, clientId: 3, pickup: '02/11', return: '04/11', rate: '5000' };
  const chk = checkForm('rentals', v, ctx(d)); assert.ok(chk.ok); assert.equal(chk.warnings.length, 1); assert.match(chk.warnings[0], /overlapping/);
});

test('editing a record shows its own values; a rental written fuel line cannot be edited on its own', () => {
  const d = data(), c = ctx(d, { existing: d.expenses[0] }), v = valuesFromRecord('expenses', d.expenses[0], c);
  assert.equal(v.amount, '700'); assert.equal(v.category, 'Garage');
  assert.equal(formIdFor('fuelAccount', { kind: 'opening' }), null); assert.equal(formIdFor('fuelAccount', { kind: 'topup' }), 'fuelTopup'); assert.equal(formIdFor('coops', {}), 'coops'); assert.equal(formIdFor('invoices', {}), null);
  assert.ok(editBlocked('expenses', { source: 'rental' })); assert.equal(editBlocked('expenses', { source: 'manual' }), '');
  assert.equal(recordMonth('payments', { date: '2026-10-02' }, TODAY), '2026-10'); assert.equal(recordMonth('payments', { date: '2026-11-02' }, TODAY), '');
});

test('the Audit lists who has not paid, what we have not paid, the rent that is missing, and never reaches 100% while anything is left', () => {
  const d = data(), a = buildAudit(d, { today: TODAY });
  const sec = id => a.sections.find(s => s.id === id);
  assert.equal(sec('owing').count, 2); assert.equal(sec('owing').amount, 12000);                          // 6,000 owed on rental 4 and all 6,000 on rental 6
  assert.equal(sec('owners').count, 1); assert.equal(sec('owners').amount, 3000);
  assert.deepEqual(sec('rent').groups[0].items.map(i => i.action.month), ['2026-11', '2026-10']);
  assert.equal(a.money.billed, 16000); assert.equal(a.money.paid, 4000); assert.equal(a.money.owed, 12000);
  assert.ok(!a.clear && a.fluency < 100 && /things left/.test(auditHeadline(a)));
  /* settle everything: pay the rentals, pay the owner, enter the rent */
  const done = data(); done.rentals[0].status = 'Completed';                                           // an Active rental past its return date is itself flagged, rightly
  done.payments.push({ id: 90, rentalId: 4, amount: 6000, date: TODAY }, { id: 91, rentalId: 6, amount: 6000, date: TODAY });
  done.rentals[1] = { ...done.rentals[1], ...markPaidPatch('owner', done.rentals[1], TODAY) };
  done.expenses.push({ id: 92, category: 'Rent', date: '2026-10-01', amount: 20000, desc: 'Rent' }, { id: 93, category: 'Rent', date: '2026-11-01', amount: 20000, desc: 'Rent' });
  const b = buildAudit(done, { today: TODAY }); assert.deepEqual(b.sections.filter(s => s.count).map(s => s.id), [], JSON.stringify(b.sections.filter(s => s.count).map(s => [s.id, s.groups.flatMap(g => g.items.map(i => i.title + ':' + (i.what || '')))])));
  assert.ok(b.clear); assert.equal(b.fluency, 100);
  assert.equal(buildAudit(done, { today: TODAY, reviewOpen: 1 }).fluency, 99);                           // an open Review item keeps it under 100
});

test('the rent alert names the months with activity and no Rent entry, with the last rent as the starting figure', () => {
  const d = data(); d.expenses.push({ id: 93, category: 'Rent', date: '2026-09-01', amount: 18000 });
  const r = rentMissing(d, TODAY); assert.deepEqual(r.recent, ['2026-11', '2026-10']); assert.equal(r.last, 18000);
  const p = rentPreset('2026-11', r.last); assert.equal(p.values.date, '2026-11-01'); assert.equal(p.values.amount, '18000'); assert.equal(p.category, 'Rent');
  const f = planSave('expenses', blankValues('expenses', ctx(d, { preset: p })), ctx(d, { preset: p })).ops[0].fields; assert.equal(f.category, 'Rent'); assert.equal(f.amount, 18000);
});

test('Analysis (inside the Audit) gives the months, the best and weakest, and the clients', () => {
  const a = buildAnalysis(data(), TODAY); assert.equal(a.empty, false);
  assert.equal(a.totals.billed, 16000); assert.ok(a.months[0].month >= a.months[a.months.length - 1].month);      // newest first
  assert.ok(a.clients.length === 2 && a.clients[0].billed >= a.clients[1].billed);
  assert.equal(buildAnalysis({ rentals: [], expenses: [], insurance: [] }, TODAY).empty, true);
});

async function fresh() {
  let t = Date.parse('2026-11-10T10:00:00.000Z');
  const platform = makePlatform(tmpDir(), { clock: () => new Date(t) });
  const db = await openDatabase(platform), identity = await ensureIdentity(db, platform);
  await db.setMeta('range', { start: 1000, end: 1999 }); await db.setMeta('nextId', 1000);
  return { db, records: createRecords({ db, identity, now: platform.now }) };
}
test('saveBatch: a client, a rental that points at it and a fuel line are saved together, in this phone\'s number range', async () => {
  const { records } = await fresh(), d = data();
  await records.create('vehicles', { reg: 'KAA 001A', rate: 5000, status: 'Available' });          // id 1000
  const v = { ...blankValues('rentals', ctx(d)), vehicleId: 1000, newClientName: 'Fresh Client', pickup: '10/11', return: '11/11', rate: '5000', fuel: '800', fuelCharge: '800' };
  d.vehicles = [{ id: 1000, reg: 'KAA 001A', rate: 5000, status: 'Available' }];
  const res = await records.saveBatch(planSave('rentals', v, ctx(d)).ops);
  assert.deepEqual(res.slice(0, 2).map(r => r.id), [1001, 1002]);
  assert.equal((await records.get('rentals', 1002)).clientId, 1001); assert.equal((await records.get('vehicles', 1000)).status, 'Rented');
  const fuel = (await records.all('expenses'))[0]; assert.equal(fuel.rentalId, 1002); assert.equal(fuel.amount, 800);
});
test('saveBatch: if one step fails nothing is saved', async () => {
  const { records } = await fresh();
  await assert.rejects(records.saveBatch([{ op: 'create', list: 'clients', fields: { name: 'X' } }, { op: 'update', list: 'rentals', id: 999, patch: {} }]), e => e.code === 'not-found');
  assert.equal((await records.all('clients')).length, 0);
  assert.deepEqual(await records.saveBatch([]), []);
});

test('typing a car, client or driver that already exists offers the existing one, ignoring spaces and case', () => {
  const d = data(); d.drivers = [{ id: 20, name: 'John Otieno', phone: '0712345678' }];
  const v = suggestions('vehicleReg', 'kaa001', d, ctx(d)); assert.equal(v.length, 1); assert.deepEqual([v[0].action, v[0].list, v[0].id], ['edit', 'vehicles', 1]); assert.match(v[0].sub, /KSh 5,000 a day/);
  assert.equal(suggestions('vehicleReg', 'k', d, ctx(d)).length, 0);                                       // one letter is not enough to suggest
  assert.equal(suggestions('vehicleReg', 'KAA 001A', d, ctx(d, { existing: d.vehicles[0] })).length, 0);    // editing the car itself is not a duplicate
  assert.equal(suggestions('clientName', 'acm', d, ctx(d))[0].id, 3);
  assert.equal(suggestions('clientName', '0712', d, ctx(d)).length, 0);
  assert.equal(suggestions('driverName', 'john o', d, ctx(d))[0].id, 20);
  const u = suggestions('rentalClient', 'wanj', d, ctx(d))[0]; assert.deepEqual([u.action, u.field, u.value, u.clear], ['use', 'clientId', 8, ['newClientName']]);
  assert.equal(suggestions('ownerName', 'omo', d, ctx(d))[0].value, 'Omondi');
  /* the same car typed with different spacing is refused, not added twice */
  assert.ok(checkForm('vehicles', { ...blankValues('vehicles', ctx(d)), reg: 'kaa-001a', rate: '5000' }, ctx(d)).errors.reg);
  assert.ok(checkForm('clients', { ...blankValues('clients', ctx(d)), name: 'a c m e' }, ctx(d)).errors.name);
});

test('search ignores spaces and case, in the pick lists and in the tables', () => {
  assert.ok(matches('KBR 670E Toyota', 'kbr670')); assert.ok(matches('KBR 670E Toyota', 'toy 670')); assert.ok(!matches('KBR 670E', 'kbs'));
  assert.ok(searchHit('KBR 670E · Axio', 'kbr670e')); assert.equal(buildTable('vehicles', { vehicles: [{ id: 1, reg: 'KAA 001A' }, { id: 2, reg: 'KBB 002B' }] }, { search: 'kbb002' }).shown, 1);
});

test('a rental takes the car\'s daily rate, shows where it came from, and it stays editable', () => {
  const d = data(), f = FORMS.rentals, v = { ...blankValues('rentals', ctx(d)), vehicleId: 1 };
  const filled = { ...v, ...f.onChange('vehicleId', v, ctx(d)) }; assert.equal(filled.rate, '5000');
  assert.match(f.fields.find(x => x.key === 'rate').hint(filled, ctx(d)), /This car's daily rate/);
  const edited = { ...filled, rate: '4500' }; assert.match(f.fields.find(x => x.key === 'rate').hint(edited, ctx(d)), /Changed for this rental/);
  assert.equal(planSave('rentals', { ...edited, clientId: 3, pickup: '10/11', return: '11/11' }, ctx(d)).ops.find(o => o.list === 'rentals').fields([]).rate, 4500);
});
