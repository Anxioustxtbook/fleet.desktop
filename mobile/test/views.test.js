/* Calendar, Performance and Reports rules: no phone and no React needed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DESKTOP } from './helpers.js';
import { monthGrid, shiftMonth } from '../src/ui/calendarView.js';
import { buildPerformance, rentalNet } from '../src/ui/performanceView.js';
import { buildReport, carStatement, periodRange, stepPeriod } from '../src/ui/reportsView.js';

const skip = DESKTOP ? false : 'set FP_DESKTOP to compare with the desktop';
const data = () => ({
  vehicles: [{ id: 1, reg: 'KAA 001A' }, { id: 2, reg: 'KBB 002B' }], clients: [{ id: 3, name: 'ACME', type: 'walkin' }, { id: 8, name: 'Coop One', type: 'coop' }], drivers: [], bookings: [{ id: 9, vehicleId: 2, clientId: 3, pickup: '2026-11-20', return: '2026-11-22', status: 'Confirmed' }],
  rentals: [{ id: 4, vehicleId: 1, clientId: 3, pickup: '2026-11-01', return: '2026-11-03', amount: 5000, fuel: 500, allowance: 200, days: 3, type: 'walkin', status: 'Active' }, { id: 6, vehicleId: 2, clientId: 8, pickup: '2026-10-05', return: '2026-10-06', amount: 3000, type: 'coop', status: 'Completed' }],
  payments: [{ id: 5, rentalId: 4, amount: 2000, date: '2026-11-02' }], expenses: [{ id: 7, vehicleId: 1, date: '2026-11-02', amount: 700, category: 'Garage' }]
});

test('the calendar month has the right shape, car lines, free and booked days, and holidays', () => {
  const g = monthGrid(data(), 2026, 10, { today: '2026-11-10' });
  assert.equal(g.title, 'November 2026'); assert.ok(g.weeks.every(w => w.length === 7));
  const cells = g.weeks.flat().filter(Boolean); assert.equal(cells.length, 30);
  assert.equal(cells.find(c => c.day === '2026-11-02').lines.length, 1);
  assert.ok(cells.find(c => c.day === '2026-11-20').booked);
  assert.ok(cells.find(c => c.day === '2026-11-10').today);
  assert.ok(monthGrid(data(), 2026, 9, {}).holidays.some(h => h.name === 'Mashujaa Day'));   // 20 October
  const one = monthGrid(data(), 2026, 10, { vehicleId: 1 }); assert.equal(one.summary.booked, 3); assert.equal(one.summary.free, 27);
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month: 0 });
});
test('performance: net is amount less fuel, allowance, sub-hire and driver pay; filters and By car agree with the rows', () => {
  const d = data(), r = rentalNet(d, d.rentals[0]); assert.equal(r.net, 4300);
  const all = buildPerformance(d); assert.equal(all.totals.rentals, 2); assert.equal(all.totals.amount, 8000);
  assert.equal(all.byCar.reduce((s, c) => s + c.net, 0), all.totals.net);
  assert.equal(buildPerformance(d, { type: 'coop' }).rows.length, 1);
  assert.equal(buildPerformance(d, { from: '2026-11-01' }).rows.length, 1);
  assert.equal(buildPerformance(d, { search: 'kbb' }).rows[0].reg, 'KBB 002B');
});
test('reports: periods, cards, per car, cars out, and a car statement', () => {
  assert.deepEqual(periodRange('week', '2026-11-10'), { from: '2026-11-09', to: '2026-11-15', label: '2026-11-09 to 2026-11-15' });
  assert.equal(periodRange('month', '2026-02-10').to, '2026-02-28'); assert.equal(periodRange('year', '2026-06-01').from, '2026-01-01');
  assert.equal(stepPeriod('month', '2026-12-15', 1), '2027-01-15');
  const d = data(), rg = periodRange('month', '2026-11-10'), rep = buildReport(d, rg, { today: '2026-11-10' });
  assert.deepEqual(rep.totals, { billed: 5000, spent: 700, received: 2000, owed: 3000, net: 4300 });
  assert.equal(rep.carsOut.length, 1); assert.equal(rep.carsOut[0].overdue, true);
  assert.equal(buildReport(d, rg, { vehicleId: 2 }).totals.billed, 0);
  const st = carStatement(d, 1, rg); assert.equal(st.at(-1).running, 4300);
});
test('the shared calendar and holiday files match the desktop\'s', { skip }, () => {
  const read = f => fs.readFileSync(f, 'utf8');
  assert.equal(read('src/shared/holidays.js'), read(path.join(DESKTOP, 'src/holidays.js')));
  assert.ok(read(path.join(DESKTOP, 'src/calendar.js')).startsWith(read('src/shared/calendarCore.js').split('\n').slice(0, 3).join('\n')));
});
