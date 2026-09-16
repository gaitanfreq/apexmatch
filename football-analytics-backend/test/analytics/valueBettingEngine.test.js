const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateImpliedProbability,
  calculateFairOdds,
  calculateOverround,
  calculateEdge,
  resolveModelProbability,
  findValueBets,
} = require('../../src/analytics/valueBettingEngine');

describe('valueBettingEngine', () => {
  test('calculateImpliedProbability: cuota 2.0 -> 50%', () => {
    assert.equal(calculateImpliedProbability(2.0), 0.5);
  });

  test('calculateImpliedProbability rechaza cuotas <= 1', () => {
    assert.throws(() => calculateImpliedProbability(1));
    assert.throws(() => calculateImpliedProbability(0.9));
  });

  test('calculateFairOdds es inversa de calculateImpliedProbability', () => {
    assert.equal(calculateFairOdds(0.4), 2.5);
  });

  test('calculateOverround: cuotas justas (sin margen) para 1X2 con probabilidades reales suman overround 0', () => {
    // probabilidades reales 0.5/0.3/0.2 -> cuotas justas 2.0/3.333.../5.0
    const overround = calculateOverround([2.0, 10 / 3, 5.0]);
    assert.ok(Math.abs(overround) < 1e-9);
  });

  test('calculateOverround: cuotas de bookmaker típicas tienen margen positivo', () => {
    // overround tipico de casa de apuestas ronda 5-8%
    const overround = calculateOverround([1.9, 3.6, 4.2]);
    assert.ok(overround > 0);
  });

  test('calculateEdge: nuestra probabilidad igual a la implícita da edge 0', () => {
    const impliedProbability = calculateImpliedProbability(2.0);
    assert.ok(Math.abs(calculateEdge(impliedProbability, 2.0)) < 1e-9);
  });

  test('calculateEdge: probabilidad 60% a cuota 2.0 da edge de 20%', () => {
    assert.ok(Math.abs(calculateEdge(0.6, 2.0) - 0.2) < 1e-9);
  });

  test('calculateEdge: probabilidad 40% a cuota 2.0 da edge negativo (-20%)', () => {
    assert.ok(Math.abs(calculateEdge(0.4, 2.0) - (-0.2)) < 1e-9);
  });

  const sampleMarkets = {
    homeWin: 0.55,
    draw: 0.25,
    awayWin: 0.2,
    doubleChance: { homeOrDraw: 0.8, awayOrDraw: 0.45, homeOrAway: 0.75 },
    overUnder: { '1.5': { over: 0.78, under: 0.22 }, '2.5': { over: 0.55, under: 0.45 } },
    btts: { yes: 0.6, no: 0.4 },
  };

  test('resolveModelProbability: Match Winner / Home', () => {
    assert.equal(resolveModelProbability(sampleMarkets, 'Match Winner', 'Home'), 0.55);
  });

  test('resolveModelProbability: Double Chance / Home/Draw', () => {
    assert.equal(resolveModelProbability(sampleMarkets, 'Double Chance', 'Home/Draw'), 0.8);
  });

  test('resolveModelProbability: Goals Over/Under con handicap 2.5, selección Over', () => {
    assert.equal(resolveModelProbability(sampleMarkets, 'Goals Over/Under', 'Over 2.5', 2.5), 0.55);
  });

  test('resolveModelProbability: Both Teams Score / Yes', () => {
    assert.equal(resolveModelProbability(sampleMarkets, 'Both Teams Score', 'Yes'), 0.6);
  });

  test('resolveModelProbability: mercado no soportado devuelve null', () => {
    assert.equal(resolveModelProbability(sampleMarkets, 'Corners Over/Under', 'Over 9.5', 9.5), null);
  });

  test('findValueBets: identifica solo cuotas con edge >= minEdge, ordenadas descendente', () => {
    const marketOdds = [
      { market: 'Match Winner', selection: 'Home', oddsDecimal: 2.1, bookmaker: 'BookA' }, // edge = 0.55*2.1-1=0.155
      { market: 'Match Winner', selection: 'Draw', oddsDecimal: 3.2, bookmaker: 'BookA' }, // edge = 0.25*3.2-1=-0.2
      { market: 'Both Teams Score', selection: 'Yes', oddsDecimal: 1.9, bookmaker: 'BookB' }, // edge=0.6*1.9-1=0.14
      { market: 'Goals Over/Under', selection: 'Over 2.5', handicap: 2.5, oddsDecimal: 1.7, bookmaker: 'BookB' }, // edge=0.55*1.7-1=-0.065
    ];

    const valueBets = findValueBets(sampleMarkets, marketOdds, { minEdge: 0.05 });

    assert.equal(valueBets.length, 2);
    assert.equal(valueBets[0].selection, 'Home');
    assert.equal(valueBets[1].selection, 'Yes');
    assert.ok(valueBets[0].edge > valueBets[1].edge);
    for (const bet of valueBets) {
      assert.ok(bet.edge >= 0.05);
      assert.ok('fairOdds' in bet);
      assert.ok('impliedProbability' in bet);
    }
  });

  test('findValueBets: sin oportunidades por debajo del umbral devuelve array vacío', () => {
    const marketOdds = [{ market: 'Match Winner', selection: 'Away', oddsDecimal: 1.5, bookmaker: 'BookA' }];
    const valueBets = findValueBets(sampleMarkets, marketOdds, { minEdge: 0.05 });
    assert.deepEqual(valueBets, []);
  });
});
