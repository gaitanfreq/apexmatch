const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { computePerformanceStats } = require('../../src/analytics/performanceStats');

describe('performanceStats.computePerformanceStats', () => {
  test('sin historial, devuelve el bankroll inicial y métricas en cero', () => {
    const result = computePerformanceStats([], { startingBankroll: 1000 });
    assert.equal(result.totalRecommendations, 0);
    assert.equal(result.winRatePct, 0);
    assert.equal(result.roiPct, 0);
    assert.equal(result.currentBankroll, 1000);
  });

  test('calcula ROI%, win rate% y bankroll final con un historial simple', () => {
    const history = [
      { stakeAmount: 50, profitLoss: 45, status: 'won', settledAt: '2025-01-01' }, // stake 50, gana cuota ~1.9
      { stakeAmount: 50, profitLoss: -50, status: 'lost', settledAt: '2025-01-02' },
      { stakeAmount: 40, profitLoss: 36, status: 'won', settledAt: '2025-01-03' },
    ];

    const result = computePerformanceStats(history, { startingBankroll: 1000 });

    assert.equal(result.totalRecommendations, 3);
    assert.equal(result.wins, 2);
    assert.equal(result.losses, 1);
    assert.ok(Math.abs(result.winRatePct - (2 / 3) * 100) < 1e-9);

    const totalStaked = 50 + 50 + 40;
    const totalProfitLoss = 45 - 50 + 36;
    assert.ok(Math.abs(result.totalStaked - totalStaked) < 1e-9);
    assert.ok(Math.abs(result.totalProfitLoss - totalProfitLoss) < 1e-9);
    assert.ok(Math.abs(result.roiPct - (totalProfitLoss / totalStaked) * 100) < 1e-9);
    assert.ok(Math.abs(result.currentBankroll - (1000 + totalProfitLoss)) < 1e-9);
  });

  test('la curva de bankroll es monotónicamente registrada por cada resultado, en orden', () => {
    const history = [
      { stakeAmount: 100, profitLoss: 90, status: 'won', settledAt: '2025-01-01' },
      { stakeAmount: 100, profitLoss: -100, status: 'lost', settledAt: '2025-01-02' },
    ];

    const result = computePerformanceStats(history, { startingBankroll: 500 });

    assert.equal(result.bankrollCurve.length, 3); // punto inicial + 2 resultados
    assert.equal(result.bankrollCurve[0].bankroll, 500);
    assert.equal(result.bankrollCurve[1].bankroll, 590);
    assert.equal(result.bankrollCurve[2].bankroll, 490);
  });

  test('registros con status distinto de won/lost no cuentan para el win rate pero sí afectan el bankroll si tienen profitLoss', () => {
    const history = [
      { stakeAmount: 50, profitLoss: 0, status: 'void', settledAt: '2025-01-01' },
      { stakeAmount: 50, profitLoss: 45, status: 'won', settledAt: '2025-01-02' },
    ];

    const result = computePerformanceStats(history, { startingBankroll: 1000 });
    assert.equal(result.wins, 1);
    assert.equal(result.losses, 0);
    assert.equal(result.winRatePct, 100); // solo se consideran decididos (won+lost)
  });
});
