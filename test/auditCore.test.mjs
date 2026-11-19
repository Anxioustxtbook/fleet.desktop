import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAudit } from '../src/auditCore.js';

const empty = () => ({
  period: { start: '2026-01-01', end: '2026-12-31' },
  vehicles: [], drivers: [], clients: [], rentals: [], payments: [], expenses: [], fuelAccount: []
});

test('Audit calculates unpaid balances and flags pending records without changing the ledger', () => {
  const db = empty();
  db.vehicles.push({ id: 1, reg: 'CAR-1', rate: 100, ownership: 'subhire', owner: 'Owner' });
  db.clients.push({ id: 2, name: 'Client' });
  db.rentals.push({
    id: 3, vehicleId: 1, clientId: 2, pickup: '2026-06-01', return: '2026-06-03',
    amount: 300, days: 2, status: 'Returned', subhireCost: 80, subhireStatus: 'notcleared'
  });
  db.payments.push({ id: 4, rentalId: 3, amount: 100, date: '2026-06-01' });
  db.fuelAccount.push({ id: 5, kind: 'topup', amount: 10, date: '2026-06-01' });
  db.expenses.push({ id: 6, vehicleId: 1, date: '2026-06-02', category: 'Fuel', amount: 20, account: 'Ola' });
  const before = structuredClone(db);
  const audit = buildAudit(db, '2026-06-10');
  assert.equal(audit.money.billed, 300);
  assert.equal(audit.money.paid, 100);
  assert.equal(audit.money.owed, 200);
  assert.equal(audit.money.ownersOwed, 80);
  assert.equal(audit.fuelOwed, 10);
  assert.equal(audit.owing[0].action.rentalId, 3);
  assert.ok(audit.todo > 0);
  assert.deepEqual(db, before);
});

test('Audit identifies missing rent for active months and caps the displayed list at three', () => {
  const db = empty();
  for(const month of ['2026-02', '2026-03', '2026-04', '2026-05']){
    db.rentals.push({ id: month, pickup: `${month}-10`, status: 'Returned', amount: 10 });
  }
  const audit = buildAudit(db, '2026-05-15');
  assert.deepEqual(audit.missingRent, ['2026-05', '2026-04', '2026-03']);
  assert.equal(audit.earlierRentCount, 1);
});

test('Configured standing rent covers its effective months instead of creating false alerts', () => {
  const db = empty();
  db.settings = { standingExpenses: [{ category: 'Rent', amount: 20000, fromMonth: '2026-02' }] };
  db.rentals.push({ id: 1, pickup: '2026-02-10', status: 'Returned', amount: 10 });
  assert.deepEqual(buildAudit(db, '2026-02-15').missingRent, []);
});

test('Audit flags duplicate fuel fills and malformed records once each', () => {
  const db = empty();
  db.vehicles.push({ id: 1, reg: '', rate: 0 });
  db.expenses.push(
    { id: 2, vehicleId: 1, date: '2026-01-01', category: 'Fuel', amount: 5 },
    { id: 3, vehicleId: 1, date: '2026-01-01', category: 'Fuel', amount: 5 }
  );
  const audit = buildAudit(db, '2026-01-10');
  assert.ok(audit.gaps.some(g => g.list === 'vehicles' && g.missing.includes('registration')));
  assert.ok(audit.gaps.some(g => g.list === 'expenses' && g.id === 3 && g.missing.some(x => x.includes('same vehicle'))));
  assert.equal(audit.flagged, 3);
});

test('phone review items are included in Audit attention counts without affecting record coverage', () => {
  const audit = buildAudit(empty(), '2026-01-10', 2);
  assert.equal(audit.reviewOpen, 2);
  assert.equal(audit.todo, 2);
  assert.equal(audit.examined, 0);
  assert.equal(audit.fluency, 99);
});
