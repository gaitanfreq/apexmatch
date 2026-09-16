const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { computeProfitLoss } = require('../../src/repositories/bankrollRepository');

describe('bankrollRepository.computeProfitLoss', () => {
  test('apuesta ganada: stake * (cuota - 1)', () => {
    assert.ok(Math.abs(computeProfitLoss('won', 50, 2.0) - 50) < 1e-9);
    assert.ok(Math.abs(computeProfitLoss('won', 100, 1.5) - 50) < 1e-9);
  });

  test('apuesta perdida: -stake', () => {
    assert.equal(computeProfitLoss('lost', 50, 2.0), -50);
    assert.equal(computeProfitLoss('lost', 30, 5.5), -30);
  });

  test('apuesta anulada (void): 0, sin importar cuota/stake', () => {
    assert.equal(computeProfitLoss('void', 50, 2.0), 0);
  });
});
