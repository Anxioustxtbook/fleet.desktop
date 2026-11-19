import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('calendar screen uses live month data, selected-day vehicle status, and booking/detail actions', () => {
  const app = read('../App.js'), calendar = read('../src/ui/screens/Calendar.js');
  assert.match(app, /calendar:\s*Calendar/);
  for (const feature of ['monthGrid', 'shiftMonth', 'vehicleColor', 'openRecord', 'Holidays this month', 'Free', 'Booked']) assert.ok(calendar.includes(feature), feature);
  assert.ok(calendar.includes("setForm({ form: 'bookings'"));
});
