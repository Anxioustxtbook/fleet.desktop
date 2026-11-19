import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { layoutFields } from '../src/ui/formLayout.js';

const fields = (...keys) => keys.map(key => ({ key }));

test('prototype form pairs are arranged together without losing fields', () => {
  const rows = layoutFields('vehicles', fields('rate', 'reg', 'model', 'make', 'year'));
  assert.deepEqual(rows.map(row => row.map(field => field.key)), [['reg'], ['make', 'model'], ['year', 'rate']]);
});

test('expense layout pairs date and amount before the description while preserving remaining fields', () => {
  const rows = layoutFields('expenses', fields('category', 'vehicleId', 'date', 'desc', 'amount', 'qty'));
  assert.deepEqual(rows.map(row => row.map(field => field.key)), [
    ['category', 'vehicleId'], ['date', 'amount'], ['desc'], ['qty']
  ]);
});

test('conditional fields can disappear without breaking remaining client field pairs', () => {
  const rows = layoutFields('clients', fields('name', 'phone', 'type', 'idnum', 'area', 'driverPhone'));
  assert.deepEqual(rows.map(row => row.map(field => field.key)), [
    ['name'], ['phone', 'type'], ['idnum', 'area'], ['driverPhone']
  ]);
});

test('the entry form uses grouped rows for layout and Enter/focus order', () => {
  const source = fs.readFileSync(new URL('../src/ui/screens/EntryForm.js', import.meta.url), 'utf8');
  assert.match(source, /layoutFields\(form, visibleFields\(form, vals \|\| values, ctx\)\)\.flat\(\)/);
  assert.match(source, /const fieldRows = layoutFields\(form, fields\)/);
  assert.match(source, /placeholder=\{f\.placeholder \|\|/);
  assert.match(source, /overlay=\{confirmLeave \? <LeaveConfirmation/);
});
