import ExcelJS from 'exceljs';
import { LISTS } from './config.js';

const TABLES = [
  ['Vehicles', 'vehicles', ['id', 'reg', 'make', 'model', 'year', 'rate', 'owner', 'status', 'billMode', 'billHours', 'hourRate', 'ownership', 'ownerCost', 'oneOff']],
  ['Drivers', 'drivers', ['id', 'name', 'phone', 'license', 'vehicleId', 'allowance', 'status', 'kind']],
  ['Clients', 'clients', ['id', 'name', 'phone', 'idnum', 'dl', 'type', 'area', 'usualReg', 'driverName', 'driverPhone']],
  ['Bookings', 'bookings', ['id', 'vehicleId', 'clientId', 'bookedOn', 'pickup', 'return', 'deposit', 'status', 'reminderAck']],
  ['Rentals', 'rentals', ['id', 'vehicleId', 'clientId', 'contract', 'invoice', 'receipt', 'pickup', 'pickupTime', 'return', 'returnTime', 'rate', 'days', 'mileage', 'amount', 'status', 'fuel', 'fuelCharge', 'type', 'driverId', 'billMode', 'hours', 'allowance', 'allowanceDate', 'subhireCost', 'subhirePaid', 'subhirePaidDate', 'subhireStatus', 'job', 'driverRate', 'driverStatus', 'driverStatusDate', 'paid', 'paidDate', 'xlRef', 'notes', 'allowanceRefs']],
  ['Expenses', 'expenses', ['id', 'vehicleId', 'date', 'category', 'desc', 'qty', 'amount', 'billable', 'billClientId', 'chargeAmount', 'source', 'rentalId', 'xlRef']],
  ['Payments', 'payments', ['id', 'rentalId', 'date', 'amount', 'method', 'note', 'xlRef', 'source', 'invoiceNo', 'linkKind']],
  ['Invoices', 'invoices', ['id', 'clientId', 'client', 'no', 'date', 'month', 'amount', 'vat', 'status', 'note', 'xlRef']],
  ['DriverAllowances', 'driverAllowances', ['id', 'driverId', 'weekStart', 'amount', 'note']],
  ['Accounts', 'accounts', ['id', 'account', 'month', 'date', 'kind', 'amount', 'label', 'note', 'xlRef']],
  ['Loans', 'loans', ['id', 'lender', 'item', 'borrowed', 'instalment', 'dueDay', 'startDate', 'endDate', 'paidThrough', 'note', 'schedule', 'xlRef']],
  ['Insurance', 'insurance', ['id', 'vehicleId', 'kind', 'amount', 'paidDate', 'expiryDate', 'note', 'xlRef']],
  ['Chama', 'chama', ['id', 'scheme', 'slot', 'dueDate', 'amount', 'paid', 'paidDate', 'note', 'xlRef']],
  ['Coops', 'coops', ['id', 'name', 'clientId', 'start', 'end', 'days', 'amount', 'driverPay', 'allowance', 'fuel', 'contract', 'department', 'kmOut', 'kmIn', 'withVat', 'note', 'rentalId', 'status', 'xlRef']],
  ['Individuals', 'individuals', ['id', 'person', 'date', 'amount', 'note', 'order', 'xlRef']],
  ['FuelAccount', 'fuelAccount', ['id', 'date', 'kind', 'amount', 'note', 'xlRef']]
];

const TABLE_BY_NAME = new Map(TABLES.map(([name, list, columns]) => [name.toLowerCase(), { name, list, columns }]));
const TABLE_BY_LIST = new Map(TABLES.map(([name, list, columns]) => [list, { name, list, columns }]));
const SETTINGS_COLUMNS = [
  'chartType', 'includeStatement', 'includeExpenseReport', 'includeFuelReport', 'includeTotals', 'periodStart',
  'periodLabel', 'dashboardWidgets', 'lastModified', 'exportPrefs', 'standingExpenses', 'overviewSnapshots',
  'importDecisions', 'perfColumns', 'holidayFixes', 'idleMinutes', 'rowFormats', 'loanExtraMonths',
  'expenseTypes', 'pilotConfig', 'csvExport', 'adminPin', 'exportScope'
];
const DATE_FIELD = {
  bookings: 'pickup', rentals: 'pickup', expenses: 'date', payments: 'date', invoices: 'date',
  driverAllowances: 'weekStart', accounts: 'date', insurance: 'paidDate', chama: 'dueDate',
  coops: 'start', individuals: 'date', fuelAccount: 'date'
};
const REFERENCE_LISTS = new Set(['vehicles', 'drivers', 'clients']);
const SOURCE_HINTS = [
  [/rental|car perf|performance/i, 'Rentals'],
  [/fuel/i, 'Fuel'],
  [/coop/i, 'Coop'],
  [/sub.?hire/i, 'Sub-hire'],
  [/ochwada/i, 'Payments to owner (OCHWADA)'],
  [/walk/i, 'Walk-in clients'],
  [/sheet1|overview/i, 'Overview'],
  [/car ?wash|garage|transport|airport|allowance|rent|expense/i, 'Expenses'],
  [/loan|insurance/i, 'Admin (loans, insurance)']
];

function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function rangeFor(scope, now) {
  const y = now.getFullYear(), m = now.getMonth();
  if (scope === 'year') return { start: `${y}-01-01`, end: `${y}-12-31`, label: String(y) };
  const first = scope === 'previous' ? new Date(y, m - 1, 1) : new Date(y, m, 1);
  const last = scope === 'previous' ? new Date(y, m, 0) : new Date(y, m + 1, 0);
  return { start: localDate(first), end: localDate(last), label: `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}` };
}

function includeRecord(list, record, range) {
  if (!range || REFERENCE_LISTS.has(list)) return true;
  const field = DATE_FIELD[list];
  if (!field) return true;
  const date = String(record[field] || '').slice(0, 10);
  return !date || (date >= range.start && date <= range.end);
}

function excelValue(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== 'object') return value;
  if (typeof value.text === 'string') return value.text;
  if (Array.isArray(value.richText)) return value.richText.map(part => part.text || '').join('');
  if (Object.prototype.hasOwnProperty.call(value, 'result')) return excelValue(value.result);
  return JSON.stringify(value);
}

function readTable(worksheet, columns) {
  if (!worksheet || worksheet.rowCount < 2) return [];
  const header = worksheet.getRow(1);
  const indexes = new Map();
  for (let col = 1; col <= worksheet.columnCount; col++) {
    const name = String(excelValue(header.getCell(col).value) || '').trim();
    if (name) indexes.set(col, name);
  }
  const splitColumns = [...indexes.entries()].flatMap(([col, name]) => {
    const match = /^(.+)~(\d+)$/.exec(name);
    return match && columns.includes(match[1]) ? [{ col, name: match[1], part: Number(match[2]) }] : [];
  }).sort((a, b) => a.part - b.part || a.col - b.col);
  const rows = [], ids = new Set();
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record = {};
    for (const [col, name] of indexes) {
      if (columns.includes(name)) record[name] = excelValue(row.getCell(col).value);
    }
    for (const part of splitColumns) {
      const value = excelValue(row.getCell(part.col).value);
      if (value !== '') record[part.name] = `${record[part.name] || ''}${value}`;
    }
    if (record.id === '' || record.id == null) return;
    const id = String(record.id);
    if (!Number.isFinite(Number(id)) || Number(id) <= 0) return;
    if (ids.has(id)) throw new Error(`The ${worksheet.name} sheet contains duplicate record number ${id}.`);
    ids.add(id);
    record.id = Number(id);
    rows.push(record);
  });
  return rows;
}

function isWholeBackup(workbook) {
  const hasTables = TABLES.every(([name]) => {
    const worksheet = workbook.getWorksheet(name);
    if (!worksheet) return false;
    const headers = worksheet.getRow(1).values.map(value => String(excelValue(value) || '').trim().toLowerCase());
    return headers.includes('id');
  });
  if (!hasTables || !workbook.getWorksheet('Meta') || !workbook.getWorksheet('Settings'))
    return { valid: false, canReplace: false };
  const settings = workbook.getWorksheet('Settings');
  const meta = workbook.getWorksheet('Meta');
  const metaHeaders = new Set(meta.getRow(1).values.map(value => String(excelValue(value) || '').toLowerCase()));
  if (!metaHeaders.has('nextid')) return { valid: false, canReplace: false };
  const settingsRow = settings.getRow(2);
  const scopeCol = settings.getRow(1).values.findIndex(value => String(excelValue(value) || '').toLowerCase() === 'exportscope');
  const prefsCol = settings.getRow(1).values.findIndex(value => String(excelValue(value) || '').toLowerCase() === 'exportprefs');
  let scope = scopeCol > 0 ? String(excelValue(settingsRow.getCell(scopeCol).value) || '') : '';
  if (!scope && prefsCol > 0) {
    try { scope = JSON.parse(String(excelValue(settingsRow.getCell(prefsCol).value) || '{}')).scope || ''; } catch (e) { scope = ''; }
  }
  return { valid: true, canReplace: scope === 'all' };
}

export async function makeExcelBackup(data, { scope = 'current', now = new Date() } = {}) {
  const range = rangeFor(scope, now);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FleetPilot';
  workbook.created = now;
  for (const [name, list, columns] of TABLES) {
    const worksheet = workbook.addWorksheet(name);
    worksheet.addRow(columns);
    for (const record of data[list] || []) {
      if (includeRecord(list, record, range)) worksheet.addRow(columns.map(column => record[column] ?? ''));
    }
  }
  const nextId = Math.max(0, ...LISTS.flatMap(list => (data[list] || []).map(record => Number(record.id) || 0))) + 1;
  const meta = workbook.addWorksheet('Meta');
  meta.addRow(['nextId']);
  meta.addRow([nextId]);
  const settings = workbook.addWorksheet('Settings');
  settings.addRow(SETTINGS_COLUMNS);
  settings.addRow(SETTINGS_COLUMNS.map(key => ({
    chartType: 'pie',
    includeStatement: true,
    includeExpenseReport: false,
    includeFuelReport: false,
    includeTotals: true,
    periodStart: range.start,
    periodLabel: range.label,
    lastModified: now.toISOString(),
    exportPrefs: JSON.stringify({ scope }),
    adminPin: '',
    exportScope: scope
  }[key] ?? '')));
  const bytes = await workbook.xlsx.writeBuffer();
  const name = scope === 'year' ? `FleetPilot-${range.label}.xlsx` : `FleetPilot-${range.label}.xlsx`;
  return { bytes, name, total: LISTS.reduce((sum, list) => sum + (data[list] || []).filter(record => includeRecord(list, record, range)).length, 0) };
}

export async function inspectExcelBackup(bytes) {
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(bytes); }
  catch (error) { throw new Error(`Excel could not read this file. Select a valid .xlsx workbook. ${error && error.message ? error.message : ''}`.trim()); }

  const data = Object.fromEntries(LISTS.map(list => [list, []]));
  const tables = new Map(TABLES.map(([name, list, columns]) => [name.toLowerCase(), { list, columns }]));
  const recordSheets = new Set();
  const sheets = workbook.worksheets.map(worksheet => {
    const table = tables.get(worksheet.name.trim().toLowerCase());
    const hint = SOURCE_HINTS.find(([pattern]) => pattern.test(worksheet.name));
    if (table) {
      const rows = readTable(worksheet, TABLE_BY_LIST.get(table.list).columns);
      data[table.list] = rows;
      recordSheets.add(table.list);
      return { name: worksheet.name, rows: rows.length, target: table.list, recognized: true, importable: true };
    }
    return { name: worksheet.name, rows: Math.max(0, worksheet.rowCount - 1), target: hint ? hint[1] : '', recognized: !!hint, importable: false };
  });
  const backup = isWholeBackup(workbook);
  return {
    sheets,
    data,
    total: Object.values(data).reduce((sum, records) => sum + records.length, 0),
    recordSheets: [...recordSheets],
    isBackup: backup.valid,
    canReplace: backup.canReplace,
    recognizedSource: sheets.some(sheet => sheet.recognized && !sheet.importable),
    missingSheets: TABLES.filter(([name]) => !workbook.getWorksheet(name)).map(([name]) => name)
  };
}

function importData(data, selectedLists) {
  const selected = new Set(selectedLists);
  return Object.fromEntries(LISTS.map(list => [list, selected.has(list) ? data[list] || [] : []]));
}

export function createExcelFiles({ records, backup, platform, now }) {
  async function snapshotPreview(data, selectedLists, mode) {
    if (mode !== 'merge' && mode !== 'replace') throw new Error('Choose Merge or Replace to review this workbook.');
    const selected = [...new Set(selectedLists)].filter(list => LISTS.includes(list));
    if (!selected.length) throw new Error('Choose at least one recognized sheet to import.');
    if (mode === 'replace' && !data.canReplace) throw new Error('This workbook is not marked as a complete backup. Replace is disabled to protect records that are not in the file.');
    if (mode === 'replace' && selected.length !== LISTS.length)
      throw new Error('Choose every data sheet before replacing the phone records.');
    const incoming = importData(data.data, selected);
    const snapshot = await records.captureSnapshot();
    const current = new Map();
    for (const list of LISTS) for (const record of snapshot.records[list]) current.set(`${list}|${record.id}`, record);
    const result = { added: 0, updated: 0, skipped: 0, removed: 0 };
    const incomingKeys = new Set();
    for (const list of LISTS) for (const record of incoming[list]) {
      const key = `${list}|${record.id}`;
      incomingKeys.add(key);
      if (current.has(key)) result.skipped++;
      else result.added++;
    }
    if (mode === 'replace') {
      for (const list of LISTS) for (const record of snapshot.records[list]) if (!incomingKeys.has(`${list}|${record.id}`)) result.removed++;
    }
    return { ...result, total: Object.values(incoming).reduce((sum, rows) => sum + rows.length, 0), expected: { seq: snapshot.seq, ack: snapshot.ack }, selected };
  }

  return {
    pick() {
      return platform.fs.pickExcel();
    },
    inspect: inspectExcelBackup,
    async preview(data, selectedLists, mode) {
      return snapshotPreview(data, selectedLists, mode);
    },
    async import(data, selectedLists, mode, expected) {
      const review = await snapshotPreview(data, selectedLists, mode);
      if (expected && (expected.seq !== review.expected.seq || expected.ack !== review.expected.ack))
        throw new Error('The phone changed after the file review. Review the workbook again before saving.');
      if (mode === 'replace') {
        const safety = await backup.refresh();
        if (!safety || safety.ok !== true)
          throw new Error(`The safety backup could not be completed, so the restore was cancelled.${safety && safety.error ? ` ${safety.error}` : ''}`);
      }
      const snapshot = await records.captureSnapshot();
      const result = await records.importSnapshot(importData(data.data, review.selected), mode, { undoSnapshot: snapshot, expected });
      return { ...result, total: review.total };
    },
    async export(scope) {
      const data = {};
      for (const list of LISTS) data[list] = await records.all(list);
      const result = await makeExcelBackup(data, { scope, now: now() });
      await platform.fs.shareExcel(result.name, result.bytes);
      return { name: result.name, total: result.total };
    }
  };
}

export const EXCEL_TABLES = TABLES.map(([name, list, columns]) => ({ name, list, columns }));
