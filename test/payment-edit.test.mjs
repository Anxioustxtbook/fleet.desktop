import assert from 'node:assert/strict';
import test from 'node:test';
import { updateRentalPayment } from '../src/payRoute.js';

const isReasonableDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '');
const isValidMoney = value => Number.isFinite(Number(value)) && Number(value) > 0;

function fixture(){
  return {
    rentals: [{ id: 12, amount: 1000, status: 'Completed' }],
    payments: [
      { id: 31, rentalId: 12, amount: 300, date: '2026-11-01', method: 'Cash', note: 'first', source: 'Imported', xlRef: 'P4' },
      { id: 32, rentalId: 12, amount: 200, date: '2026-11-02', method: 'Bank transfer', note: 'second' },
      { id: 33, rentalId: '', amount: 100, date: '2026-11-03', method: 'Cash', linkKind: 'approx' }
    ]
  };
}

test('editing a payment excludes its old amount when checking the rental balance', () => {
  const db = fixture(), payment = db.payments[0];
  const result = updateRentalPayment(db, payment.id, {
    rentalId: '12', date: '2026-11-04', amount: '800', method: 'M-Pesa', note: 'corrected'
  }, isReasonableDate, isValidMoney);

  assert.equal(result.ok, true);
  assert.deepEqual(payment, {
    id: 31, rentalId: 12, amount: 800, date: '2026-11-04', method: 'M-Pesa',
    note: 'corrected', source: 'Imported', xlRef: 'P4'
  });
});

test('editing rejects an amount above the remaining balance without mutating the payment', () => {
  const db = fixture(), payment = db.payments[0], before = { ...payment };
  const result = updateRentalPayment(db, payment.id, {
    rentalId: 12, date: '2026-11-04', amount: '801', method: 'Cash', note: ''
  }, isReasonableDate, isValidMoney);

  assert.equal(result.ok, false);
  assert.match(result.text, /maximum allowed is/);
  assert.deepEqual(payment, before);
});

test('editing an unlinked payment can link it manually or remain unlinked', () => {
  const db = fixture(), payment = db.payments[2];
  const linked = updateRentalPayment(db, payment.id, {
    rentalId: '12', date: '2026-11-04', amount: '100', method: 'Cash', note: ''
  }, isReasonableDate, isValidMoney);
  assert.equal(linked.ok, true);
  assert.equal(payment.rentalId, 12);
  assert.equal(payment.linkKind, 'manual');

  const unlinked = updateRentalPayment(db, payment.id, {
    rentalId: '', date: '2026-11-05', amount: '100', method: 'Cash', note: 'advance'
  }, isReasonableDate, isValidMoney);
  assert.equal(unlinked.ok, true);
  assert.equal(payment.rentalId, '');
  assert.equal(payment.linkKind, 'manual');
});

test('editing validates required fields, date, amount, and rental existence', () => {
  const db = fixture();
  const edit = fields => updateRentalPayment(db, 31, fields, isReasonableDate, isValidMoney);
  assert.equal(edit({ date: '', amount: '1' }).text, 'Date and amount are required');
  assert.match(edit({ date: 'bad', amount: '1' }).text, /date doesn.t look right/);
  assert.match(edit({ date: '2026-11-04', amount: '0' }).text, /positive number/);
  assert.equal(edit({ rentalId: 'missing', date: '2026-11-04', amount: '1' }).text, 'The selected rental could not be found');
  assert.equal(updateRentalPayment(db, 999, { date: '2026-11-04', amount: '1' }, isReasonableDate, isValidMoney).ok, false);
});
