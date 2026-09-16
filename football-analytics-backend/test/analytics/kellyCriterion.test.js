const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateFullKellyFraction,
  calculateRecommendedStake,
  recommendBankrollAllocation,
} = require('../../src/analytics/kellyCriterion');

describe('kellyCriterion', () => {
  test('calculateFullKellyFraction: caso clásico de manual (p=0.6, cuota=2.0 -> b=1) da f*=0.2', () => {
    // f* = (b*p - q)/b = (1*0.6 - 0.4)/1 = 0.2
    assert.ok(Math.abs(calculateFullKellyFraction(0.6, 2.0) - 0.2) < 1e-9);
  });

  test('calculateFullKellyFraction: sin edge (probabilidad = implícita) da f*=0', () => {
    // cuota 2.5 -> implícita 0.4; p=0.4 -> sin edge
    assert.ok(Math.abs(calculateFullKellyFraction(0.4, 2.5)) < 1e-9);
  });

  test('calculateFullKellyFraction: edge negativo da f* negativo', () => {
    assert.ok(calculateFullKellyFraction(0.3, 2.0) < 0);
  });

  test('calculateFullKellyFraction rechaza probabilidad o cuota fuera de rango', () => {
    assert.throws(() => calculateFullKellyFraction(0, 2.0));
    assert.throws(() => calculateFullKellyFraction(1.1, 2.0));
    assert.throws(() => calculateFullKellyFraction(0.5, 1.0));
  });

  test('calculateRecommendedStake: Kelly al 25% del caso clásico (f*=0.2) recomienda 5% del bankroll', () => {
    const result = calculateRecommendedStake({
      probability: 0.6,
      decimalOdds: 2.0,
      bankroll: 1000,
      kellyMultiplier: 0.25,
      maxStakeFraction: 1, // sin tope, para aislar el cálculo de Kelly puro
    });
    assert.ok(Math.abs(result.fullKellyFraction - 0.2) < 1e-9);
    assert.ok(Math.abs(result.recommendedFraction - 0.05) < 1e-9);
    assert.ok(Math.abs(result.recommendedStake - 50) < 1e-6);
    assert.equal(result.recommendation, 'bet');
  });

  test('calculateRecommendedStake: Kelly al 50% duplica el stake del 25%', () => {
    const half = calculateRecommendedStake({
      probability: 0.6, decimalOdds: 2.0, bankroll: 1000, kellyMultiplier: 0.5, maxStakeFraction: 1,
    });
    const quarter = calculateRecommendedStake({
      probability: 0.6, decimalOdds: 2.0, bankroll: 1000, kellyMultiplier: 0.25, maxStakeFraction: 1,
    });
    assert.ok(Math.abs(half.recommendedFraction - quarter.recommendedFraction * 2) < 1e-9);
  });

  test('calculateRecommendedStake: sin edge recomienda no apostar (stake 0)', () => {
    const result = calculateRecommendedStake({ probability: 0.4, decimalOdds: 2.0, bankroll: 1000 });
    assert.equal(result.recommendedStake, 0);
    assert.equal(result.recommendation, 'no_bet');
  });

  test('calculateRecommendedStake: respeta el tope maxStakeFraction aunque Kelly sugiera más', () => {
    // p muy alta con cuota decente produce un Kelly grande
    const result = calculateRecommendedStake({
      probability: 0.9, decimalOdds: 3.0, bankroll: 1000, kellyMultiplier: 1, maxStakeFraction: 0.05,
    });
    assert.ok(result.fullKellyFraction > 0.05);
    assert.equal(result.recommendedFraction, 0.05);
    assert.equal(result.recommendedStake, 50);
    assert.equal(result.cappedByMaxStake, true);
  });

  test('calculateRecommendedStake rechaza bankroll <= 0 o kellyMultiplier fuera de rango', () => {
    assert.throws(() => calculateRecommendedStake({ probability: 0.6, decimalOdds: 2, bankroll: 0 }));
    assert.throws(() => calculateRecommendedStake({ probability: 0.6, decimalOdds: 2, bankroll: 100, kellyMultiplier: 0 }));
    assert.throws(() => calculateRecommendedStake({ probability: 0.6, decimalOdds: 2, bankroll: 100, kellyMultiplier: 1.5 }));
  });

  test('recommendBankrollAllocation: sin sobreexposición, no escala nada', () => {
    const bets = [
      { id: 'A', probability: 0.6, decimalOdds: 2.0 },
      { id: 'B', probability: 0.55, decimalOdds: 1.9 },
    ];
    const result = recommendBankrollAllocation(bets, {
      bankroll: 1000, kellyMultiplier: 0.1, maxStakeFraction: 0.05, maxTotalExposureFraction: 0.5,
    });
    assert.equal(result.scaledDown, false);
    assert.equal(result.bets.length, 2);
  });

  test('recommendBankrollAllocation: escala proporcionalmente cuando la exposición total excede el tope', () => {
    const bets = [
      { id: 'A', probability: 0.7, decimalOdds: 2.2 },
      { id: 'B', probability: 0.65, decimalOdds: 2.1 },
      { id: 'C', probability: 0.6, decimalOdds: 2.0 },
    ];
    const result = recommendBankrollAllocation(bets, {
      bankroll: 1000, kellyMultiplier: 1, maxStakeFraction: 1, maxTotalExposureFraction: 0.2,
    });

    const totalFraction = result.bets.reduce((sum, b) => sum + b.recommendedFraction, 0);
    assert.equal(result.scaledDown, true);
    assert.ok(Math.abs(totalFraction - 0.2) < 1e-9);
  });
});
