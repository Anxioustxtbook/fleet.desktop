import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCsvTransactions, createCsvExport, DEFAULT_CSV_EXPORT, normalizeCsvExport
} from '../src/csvExport.js';

test('CSV export defaults to disabled and normalizes editable settings', () => {
  assert.equal(DEFAULT_CSV_EXPORT.enabled, false);
  assert.deepEqual(normalizeCsvExport({ enabled: true, currency: ' KES ', defaultRule: { mode: 'inclusive', rate: 16 } }), {
    enabled: true,
    currency: 'KES',
    defaultRule: { mode: 'inclusive', rate: 16 },
    categoryRules: {}
  });
  assert.equal(normalizeCsvExport({ defaultRule: { mode: 'bad', rate: 200 } }).defaultRule.mode, 'none');
});

test('CSV uses the desktop schema, tax rules, date filtering, escaping, and no payment duplication', () => {
  const csv = buildCsvTransactions({
    rentals: [
      { id: 1, pickup: '2026-10-15', invoice: 'INV-001', contract: 'CTR-1', amount: 45000 },
      { id: 2, pickup: '2026-10-16', status: 'Cancelled', amount: 1000 }
    ],
    expenses: [
      { id: 3, date: '2026-10-16', xlRef: '=1+2', category: 'Fuel', desc: 'Eldoret, "Uganda Road"', amount: 8500 }
    ]
  }, {
    enabled: true,
    currency: 'KES',
    defaultRule: { mode: 'inclusive', rate: 16 },
    categoryRules: { Fuel: { mode: 'exclusive', rate: 16 } }
  }, { start: '2026-10-15', end: '2026-10-16' });

  const rows = csv.split('\r\n');
  assert.equal(rows[0], 'Transaction_Date,Reference_ID,Category,Description,Currency,Gross_Amount,Tax_Amount,Net_Amount,Filing_Period');
  assert.ok(rows.includes('"2026-10-15","INV-001","Rental income","Rental · CTR-1","KES",45000.00,6206.90,38793.10,"2026-10"'));
  assert.ok(rows.includes('"2026-10-16","\'=1+2","Fuel","Eldoret, ""Uganda Road""","KES",9860.00,1360.00,8500.00,"2026-10"'));
  assert.equal(rows.filter(Boolean).length, 3);
  assert.doesNotMatch(csv, /Payment|Cancelled/);
});

test('CSV rejects unsafe tax configuration, malformed dates, and invalid amounts', () => {
  assert.throws(() => buildCsvTransactions({ rentals: [], expenses: [] }, {
    defaultRule: { mode: 'inclusive', rate: 0 }
  }), /tax rate/);
  assert.throws(() => buildCsvTransactions({ rentals: [{ id: 1, pickup: '2026-02-30', amount: 1 }] }, {
    defaultRule: { mode: 'none', rate: 0 }
  }), /YYYY-MM-DD/);
  assert.throws(() => buildCsvTransactions({ expenses: [{ id: 1, date: '2026-01-01', amount: 'bad' }] }, {
    defaultRule: { mode: 'none', rate: 0 }
  }), /invalid amount/);
});

test('CSV settings remain phone-local and export only when enabled', async () => {
  const meta = new Map(), shared = [];
  const service = createCsvExport({
    db: {
      getMeta: async (key, fallback) => meta.has(key) ? meta.get(key) : fallback,
      setMeta: async (key, value) => meta.set(key, value)
    },
    records: { all: async list => list === 'rentals' ? [{ id: 1, pickup: '2026-01-01', amount: 25 }] : [] },
    platform: { fs: { shareCsv: async (name, contents) => { shared.push({ name, contents }); return { action: 'shared' }; } } },
    now: () => new Date('2026-01-02T00:00:00Z')
  });

  assert.equal((await service.getSettings()).enabled, false);
  await assert.rejects(service.export(), /turned off/);
  await service.saveSettings({ enabled: true, currency: 'KES', defaultRule: { mode: 'none', rate: 0 } });
  await service.export();
  assert.equal(shared[0].name, 'FleetPilot-2026-01-02.csv');
  assert.ok(shared[0].contents.startsWith('\uFEFFTransaction_Date,Reference_ID'));
});
