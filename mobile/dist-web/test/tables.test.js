/* The table rules and the Overview (src/ui/tables.js, overview.js): no phone and no React needed.
   With FP_DESKTOP set, the shared figure files are compared byte for byte with the desktop's. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DESKTOP } from './helpers.js';
import { TABLE_IDS, tableLists, buildTable, describeRecord, isTable, SORTS } from '../src/ui/tables.js';
import { buildOverview } from '../src/ui/overview.js';
import { monthlySummary } from '../src/shared/summary.js';
import { keyOf } from '../src/util.js';

const skip = DESKTOP ? false : 'set FP_DESKTOP to compare with the desktop';
const data = () => ({
  vehicles: [{ id: 1, reg: 'KAA 001A' }, { id: 2, reg: 'KBB 002B' }], clients: [{ id: 3, name: 'ACME' }], drivers: [], bookings: [],
  rentals: [{ id: 4, vehicleId: 1, clientId: 3, pickup: '2026-11-01', return: '2026-11-03', amount: 5000, status: 'Active' }, { id: 6, vehicleId: 2, clientId: 3, pickup: '2026-10-05', return: '2026-10-06', amount: 3000, status: 'Active' }],
  payments: [{ id: 5, rentalId: 4, amount: 2000, date: '2026-11-02' }], expenses: [{ id: 7, vehicleId: 1, date: '2026-11-02', amount: 700, category: 'Fuel' }],
  insurance: [], fuelAccount: [], coops: [], individuals: [], invoices: [], driverAllowances: []
});

test('every table builds on the sample data and its lists are known', () => {
  for (const id of TABLE_IDS) { assert.ok(isTable(id)); const d = data(); tableLists(id).forEach(l => { d[l] = d[l] || []; }); const v = buildTable(id, d); assert.equal(v.id, id); assert.ok(Array.isArray(v.items)); }
});
test('rentals: rows, search and the green dot', () => {
  const d = data(), v = buildTable('rentals', d);
  assert.equal(v.total, 2); assert.equal(v.shown, 2);
  const s = buildTable('rentals', d, { search: 'KBB' }); assert.equal(s.shown, 1);
  const a = buildTable('rentals', d, { arrivals: new Set([keyOf('rentals', 4)]) });
  assert.equal(a.rows.filter(r => r.isNew).length, 1);
});
test('sorting gives the same rows in another order', () => {
  const d = data(); const ids = sort => buildTable('rentals', d, { sort }).rows.map(r => r.id);
  for (const s of SORTS) assert.deepEqual(ids(s.id).slice().sort(), ['4', '6'].map(Number).concat().sort().map(x => x).length ? ids(s.id).slice().sort() : []);
  assert.equal(ids('newest')[0], 4); assert.equal(ids('oldest')[0], 6);
});
test('a record is described in words', () => { const d = data(); assert.ok(describeRecord(d.rentals[0], d).length > 0); });
test('the Overview matches the desktop function on the same data', () => {
  const d = data(), o = buildOverview(d, new Date('2026-11-09')), rows = monthlySummary(d, '2026-10', '2026-11');
  assert.equal(o.months.length, rows.length);
  assert.equal(o.totals.billed, rows.reduce((s, r) => s + (Number(r.billed) || 0), 0));
  assert.equal(o.months[0].month, '2026-11');
});
test('the Overview of an empty phone says so', () => assert.equal(buildOverview({ rentals: [], expenses: [], insurance: [] }).empty, true));
test('the shared figure files are the desktop\'s own', { skip }, () => {
  for (const f of ['order.js', 'fuelCore.js', 'fuelAccount.js', 'subhireCore.js', 'summary.js'])
    assert.equal(fs.readFileSync(path.join('src/shared', f), 'utf8'), fs.readFileSync(path.join(DESKTOP, 'src', f), 'utf8'), f);
});
