import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { LISTS } from '../src/config.js';
import { createExcelFiles, inspectExcelBackup, makeExcelBackup } from '../src/excelFiles.js';
import { cleanPrefs, PREF_DEFAULTS } from '../src/localPrefs.js';

const emptyData = () => Object.fromEntries(LISTS.map(list => [list, []]));

async function markedFullBackup(data) {
  const { bytes } = await makeExcelBackup(data, { scope: 'current', now: new Date(2026, 10, 15) });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const settings = workbook.getWorksheet('Settings');
  const scopeColumn = settings.getRow(1).values.findIndex(value => String(value || '').toLowerCase() === 'exportscope');
  settings.getRow(2).getCell(scopeColumn).value = 'all';
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

function makeRecords(data) {
  const calls = [];
  return {
    calls,
    async captureSnapshot() { return { seq: 4, ack: 2, records: structuredClone(data) }; },
    async importSnapshot(incoming, mode, options) {
      calls.push({ incoming, mode, options });
      return { added: 1, updated: 0, skipped: 0, removed: 0 };
    },
    async all(list) { return data[list]; }
  };
}

test('Excel export round-trips the FleetPilot columns and marks empty table sheets', async () => {
  const data = emptyData();
  data.vehicles.push({ id: 8, reg: 'KDA 008A', make: 'Toyota', model: 'Axio', status: 'Available' });
  data.rentals.push({ id: 13, vehicleId: 8, clientId: 4, pickup: '2026-11-04', amount: 12000, notes: 'November booking' });
  data.rentals.push({ id: 14, vehicleId: 8, clientId: 5, pickup: '2026-10-31', amount: 9000, notes: 'Outside period' });

  const { bytes, total } = await makeExcelBackup(data, { scope: 'current', now: new Date(2026, 10, 15) });
  const inspected = await inspectExcelBackup(bytes);

  assert.equal(total, 2);
  assert.equal(inspected.total, 2);
  assert.equal(inspected.data.vehicles[0].reg, 'KDA 008A');
  assert.equal(inspected.data.rentals[0].vehicleId, 8);
  assert.equal(inspected.data.rentals[0].notes, 'November booking');
  assert.equal(inspected.data.rentals.length, 1);
  assert.equal(inspected.recordSheets.length, LISTS.length);
  assert.equal(inspected.isBackup, true);
  assert.equal(inspected.canReplace, false);
});

test('Excel merge reviews existing IDs without removing current records', async () => {
  const incoming = emptyData(), current = emptyData();
  incoming.vehicles.push({ id: 1, reg: 'KDA 001A' }, { id: 2, reg: 'KDB 002B' });
  current.vehicles.push({ id: 1, reg: 'KDA 001A' });
  const { bytes } = await makeExcelBackup(incoming, { scope: 'current', now: new Date(2026, 10, 15) });
  const inspected = await inspectExcelBackup(bytes);
  const records = makeRecords(current);
  let backupCalls = 0;
  const service = createExcelFiles({
    records,
    backup: { async refresh() { backupCalls++; return { ok: true }; } },
    platform: { fs: { async pickExcel() { return null; } } },
    now: () => new Date(2026, 10, 15)
  });

  const review = await service.preview(inspected, ['vehicles'], 'merge');
  assert.equal(review.added, 1);
  assert.equal(review.skipped, 1);
  assert.equal(review.removed, 0);
  await service.import(inspected, ['vehicles'], 'merge', review.expected);
  assert.equal(records.calls[0].mode, 'merge');
  assert.equal(backupCalls, 0);
});

test('Excel restore rejects replace for partial selection and requires a safety backup', async () => {
  const data = emptyData();
  const bytes = await markedFullBackup(data);
  const inspected = await inspectExcelBackup(bytes);
  const records = makeRecords(data);
  let backupCalls = 0;
  const service = createExcelFiles({
    records,
    backup: { async refresh() { backupCalls++; return { ok: false, error: 'disk full' }; } },
    platform: { fs: { async pickExcel() { return { name: 'test.xlsx', bytes }; } } },
    now: () => new Date(2026, 10, 15)
  });

  assert.equal(inspected.isBackup, true);
  assert.equal(inspected.canReplace, true);
  await assert.rejects(service.preview(inspected, ['vehicles'], 'replace'), /every data sheet/i);
  await assert.rejects(service.import(inspected, LISTS, 'replace', { seq: 4, ack: 2 }), /safety backup could not be completed/i);
  assert.equal(backupCalls, 1);
  assert.equal(records.calls.length, 0);
});

test('a full marked workbook can replace records after a successful safety backup', async () => {
  const data = emptyData();
  const inspected = await inspectExcelBackup(await markedFullBackup(data));
  const records = makeRecords(data);
  let backupCalls = 0;
  const service = createExcelFiles({
    records,
    backup: { async refresh() { backupCalls++; return { ok: true }; } },
    platform: { fs: { async pickExcel() { return null; } } },
    now: () => new Date(2026, 10, 15)
  });

  const result = await service.import(inspected, LISTS, 'replace', { seq: 4, ack: 2 });
  assert.equal(backupCalls, 1);
  assert.equal(records.calls.length, 1);
  assert.equal(records.calls[0].mode, 'replace');
  assert.equal(records.calls[0].options.expected.seq, 4);
  assert.equal(result.removed, 0);
});

test('Excel file picker is exposed and partial workbooks cannot replace records', async () => {
  const data = emptyData();
  const { bytes } = await makeExcelBackup(data, { scope: 'current', now: new Date(2026, 10, 15) });
  const partial = new ExcelJS.Workbook();
  await partial.xlsx.load(bytes);
  partial.removeWorksheet(partial.getWorksheet('Settings').id);
  const partialBytes = new Uint8Array(await partial.xlsx.writeBuffer());
  const service = createExcelFiles({
    records: makeRecords(data),
    backup: { async refresh() { return { ok: true }; } },
    platform: { fs: { async pickExcel() { return { name: 'partial.xlsx', bytes: partialBytes }; } } },
    now: () => new Date(2026, 10, 15)
  });

  const picked = await service.pick();
  assert.equal(picked.name, 'partial.xlsx');
  assert.equal((await service.inspect(picked.bytes)).isBackup, false);
  assert.deepEqual(cleanPrefs(null).profile, { name: 'Mbadavi', phone: '', email: '' });
  assert.equal(cleanPrefs(null).guidanceEnabled, PREF_DEFAULTS.guidanceEnabled);
  assert.equal(cleanPrefs({ guidanceEnabled: false }).guidanceEnabled, false);
});
