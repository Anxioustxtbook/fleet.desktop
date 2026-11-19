import test from 'node:test';
import assert from 'node:assert/strict';
import { reportingYearFor } from '../src/reportingYear.js';

test('calendar reporting year follows January through December', () => {
  const year = reportingYearFor('2026-10-15', { mode: 'calendar' });
  assert.equal(year.startDate, '2026-01-01');
  assert.equal(year.endDate, '2026-12-31');
  assert.equal(year.label, '2026');
});

test('custom reporting year handles dates before and after the configured start month', () => {
  const settings = { mode: 'custom', startMonth: 4 };
  const beforeStart = reportingYearFor('2026-03-15', settings);
  const afterStart = reportingYearFor('2026-04-01', settings);
  assert.equal(beforeStart.startDate, '2025-04-01');
  assert.equal(beforeStart.endDate, '2026-03-31');
  assert.equal(beforeStart.label, 'FY 2025/26');
  assert.equal(afterStart.startDate, '2026-04-01');
  assert.equal(afterStart.endDate, '2027-03-31');
});

test('invalid dates are rejected rather than silently selecting a year', () => {
  assert.throws(() => reportingYearFor('not-a-date'), /valid reporting date/);
});
