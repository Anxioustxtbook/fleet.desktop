import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCsvTransactions, normalizeCsvExport } from '../src/csvExport.js';

test('CSV export defaults to disabled and does not invent tax', () => {
  const db = {
    rentals: [{ id: 8, pickup: '2026-10-15', contract: '00104', amount: 15000, status: 'Completed' }],
    expenses: [{ id: 9, date: '2026-10-16', category: 'Fuel', desc: 'Station, receipt "A"', amount: 8500 }]
  };
  const settings = normalizeCsvExport(null);
  assert.equal(settings.enabled, false);
  const csv = buildCsvTransactions(db, settings);
  assert.match(csv, /"00104","Rental income","Rental · 00104","KES",15000\.00,0\.00,15000\.00,"2026-10"/);
  assert.match(csv, /"Station, receipt ""A"""/);
  assert.match(csv, /8500\.00,0\.00,8500\.00/);
});

test('CSV export calculates inclusive and exclusive tax in cents by category', () => {
  const db = {
    rentals: [{ id: 1, pickup: '2026-10-15', amount: 116, status: 'Completed' }],
    expenses: [{ id: 2, date: '2026-10-16', category: 'Fuel', amount: 100 }]
  };
  const settings = {
    currency: 'KES',
    defaultRule: { mode: 'inclusive', rate: 16 },
    categoryRules: { Fuel: { mode: 'exclusive', rate: 16 } }
  };
  const rows = buildCsvTransactions(db, settings).split('\r\n');
  assert.match(rows[1], /116\.00,16\.00,100\.00/);
  assert.match(rows[2], /116\.00,16\.00,100\.00/);
});

test('CSV export filters by date, excludes cancelled rentals, and escapes formula-like text', () => {
  const db = {
    rentals: [
      { id: 1, pickup: '2026-10-15', amount: 10, status: 'Completed', contract: '=1+1' },
      { id: 2, pickup: '2026-10-16', amount: 20, status: 'Cancelled' }
    ],
    expenses: [{ id: 3, date: '2026-11-01', category: 'Fuel', desc: '@SUM(A1)', amount: 5 }]
  };
  const csv = buildCsvTransactions(db, { defaultRule: { mode: 'none', rate: 0 } }, { start: '2026-10-01', end: '2026-10-31' });
  assert.match(csv, /"'=1\+1"/);
  assert.doesNotMatch(csv, /RENTAL-2|@SUM/);
  assert.equal(csv.split('\r\n').filter(Boolean).length, 2);
});

test('invalid configured tax rates safely normalize to zero', () => {
  assert.deepEqual(normalizeCsvExport({ defaultRule: { mode: 'inclusive', rate: 999 } }).defaultRule, { mode: 'inclusive', rate: 0 });
});
