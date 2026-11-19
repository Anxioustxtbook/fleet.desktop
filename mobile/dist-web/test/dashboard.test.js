import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboardData } from '../src/ui/dashboardData.js';

const TODAY = '2026-11-15';
const data = {
  vehicles: [{ id: 1, reg: 'KAA 001A', make: 'Toyota', model: 'Vitz' }],
  clients: [{ id: 2, name: 'Ndege Tours' }],
  rentals: [
    { id: 10, vehicleId: 1, clientId: 2, pickup: '2026-11-10', return: '2026-11-20', amount: 1000, rate: 100, days: 10, status: 'Active' },
    { id: 11, vehicleId: 1, clientId: 2, pickup: '2026-10-10', return: '2026-10-15', amount: 500, rate: 100, days: 5, status: 'Completed' },
    { id: 12, vehicleId: 1, clientId: 2, pickup: '2026-11-01', amount: 900, status: 'Cancelled' }
  ],
  payments: [{ id: 20, rentalId: 10, amount: 600, date: '2026-11-12' }, { id: 21, rentalId: 11, amount: 500, date: '2026-10-15' }],
  expenses: [{ id: 30, vehicleId: 1, category: 'Fuel', amount: 100, date: '2026-11-12' }],
  bookings: [
    { id: 40, vehicleId: 1, clientId: 2, pickup: '2026-11-16', status: 'Pending' },
    { id: 41, vehicleId: 1, clientId: 2, pickup: '2026-11-18', status: 'Cancelled' }
  ],
  drivers: [],
  fuelAccount: [],
  insurance: []
};

test('Full dashboard totals and lists come from live records, excluding cancelled entries', () => {
  const dashboard = buildDashboardData(data, TODAY);
  assert.deepEqual(dashboard.metrics, {
    vehicles: 1, onRent: 1, bookings: 1, billed: 1500, received: 1100, fuel: 100, net: 1400, owed: 400
  });
  assert.equal(dashboard.currentRentals[0].reg, 'KAA 001A');
  assert.equal(dashboard.currentRentals[0].client, 'Ndege Tours');
  assert.deepEqual(dashboard.bookings.map(booking => booking.id), [40]);
  assert.equal(dashboard.byCar.length, 1);
  assert.equal(dashboard.byCar[0].amount, 1000);
});

test('Full dashboard trend has 12 consecutive months ending in the current month', () => {
  const months = buildDashboardData(data, TODAY).trend;
  assert.equal(months.length, 12);
  assert.equal(months[months.length - 1].month, '2026-11');
  assert.equal(months[months.length - 1].revenue, 1000);
  assert.equal(months[months.length - 1].expenses, 100);
  assert.equal(months[0].month, '2025-12');
});

test('the swipe destination deskdash is registered to the Full dashboard, not a placeholder', async () => {
  const { readFile } = await import('node:fs/promises');
  const app = await readFile(new URL('../App.js', import.meta.url), 'utf8');
  const screen = await readFile(new URL('../src/ui/screens/Dashboard.js', import.meta.url), 'utf8');
  assert.match(app, /deskdash:\s*Dashboard/);
  assert.match(screen, /import \{ todayISO \} from '\.\.\/forms\.js'/);
  assert.match(screen, /buildDashboardData/);
  assert.doesNotMatch(app, /deskdash:\s*Placeholder/);
});
