const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  selectBestLegPerMatch,
  combineLegs,
  buildGreedyParlay,
  buildLowRiskParlays,
} = require('../../src/analytics/parlayBuilder');

describe('parlayBuilder', () => {
  const legs = [
    { matchId: 1, market: 'Double Chance', selection: 'Home/Draw', probability: 0.9, odds: 1.25 },
    { matchId: 1, market: 'Both Teams Score', selection: 'Yes', probability: 0.65, odds: 1.7 }, // mismo partido, peor prob -> descartada
    { matchId: 2, market: 'Goals Over/Under', selection: 'Over 1.5', probability: 0.85, odds: 1.35 },
    { matchId: 3, market: 'Both Teams Score', selection: 'Yes', probability: 0.8, odds: 1.55 },
    { matchId: 4, market: 'Double Chance', selection: 'Away/Draw', probability: 0.62, odds: 1.6 },
    { matchId: 5, market: 'Corners Over/Under', selection: 'Over 9.5', probability: 0.9, odds: 1.4 }, // mercado no permitido
    { matchId: 6, market: 'Goals Over/Under', selection: 'Over 1.5', probability: 0.5, odds: 2.0 }, // por debajo de minLegProbability
  ];

  test('selectBestLegPerMatch: filtra mercados no permitidos, probabilidad mínima, y deduplica por partido', () => {
    const result = selectBestLegPerMatch(legs, { minLegProbability: 0.6 });
    const matchIds = result.map((l) => l.matchId);

    assert.ok(!matchIds.includes(5)); // mercado no permitido
    assert.ok(!matchIds.includes(6)); // probabilidad < 0.6
    assert.equal(matchIds.filter((id) => id === 1).length, 1); // solo una leg por partido 1
    assert.equal(result.find((l) => l.matchId === 1).selection, 'Home/Draw'); // se queda con la de mayor prob

    // debe estar ordenado descendente por probabilidad
    for (let i = 1; i < result.length; i += 1) {
      assert.ok(result[i - 1].probability >= result[i].probability);
    }
  });

  test('combineLegs: probabilidad acumulada y cuota combinada son productos simples', () => {
    const sample = [
      { probability: 0.9, odds: 1.25 },
      { probability: 0.8, odds: 1.5 },
    ];
    const result = combineLegs(sample);
    assert.ok(Math.abs(result.cumulativeProbability - 0.72) < 1e-9);
    assert.ok(Math.abs(result.combinedOdds - 1.875) < 1e-9);
  });

  test('buildGreedyParlay: incluye la mayor cantidad de legs posible sin cruzar el umbral', () => {
    const sorted = [
      { matchId: 1, probability: 0.9, odds: 1.25 },
      { matchId: 2, probability: 0.85, odds: 1.35 },
      { matchId: 3, probability: 0.8, odds: 1.55 },
    ];
    // 0.9*0.85=0.765 (<0.85 umbral hipotético alto) -> probemos con umbral realista 0.85 en general
    const result = buildGreedyParlay(sorted, { minCumulativeProbability: 0.6, maxLegs: 6, minLegs: 2 });
    assert.ok(result.cumulativeProbability >= 0.6);
    assert.ok(result.legs.length >= 2);
  });

  test('buildGreedyParlay: devuelve null si no se alcanza minLegs por encima del umbral', () => {
    const sorted = [
      { matchId: 1, probability: 0.7, odds: 1.4 },
      { matchId: 2, probability: 0.7, odds: 1.4 },
    ];
    // 0.7*0.7=0.49 < 0.85 -> no se puede construir un paquete válido de 2 legs
    const result = buildGreedyParlay(sorted, { minCumulativeProbability: 0.85, maxLegs: 6, minLegs: 2 });
    assert.equal(result, null);
  });

  test('buildLowRiskParlays: paquete final cumple probabilidad acumulada proyectada > 85%', () => {
    const highProbLegs = [
      { matchId: 1, market: 'Double Chance', selection: 'Home/Draw', probability: 0.93, odds: 1.2 },
      { matchId: 2, market: 'Goals Over/Under', selection: 'Over 1.5', probability: 0.92, odds: 1.25 },
      { matchId: 3, market: 'Both Teams Score', selection: 'Yes', probability: 0.91, odds: 1.3 },
    ];

    const result = buildLowRiskParlays(highProbLegs, { minLegProbability: 0.6, minCumulativeProbability: 0.85 });

    assert.ok(result.bestParlay !== null);
    assert.ok(result.bestParlay.cumulativeProbability > 0.85);
    assert.ok(result.bestParlay.legs.length >= 2);

    for (const alt of result.alternatives) {
      assert.ok(alt.cumulativeProbability > 0.85);
    }
  });

  test('buildLowRiskParlays: pool insuficiente (probabilidades bajas) no produce paquete', () => {
    const lowProbLegs = [
      { matchId: 1, market: 'Double Chance', selection: 'Home/Draw', probability: 0.65, odds: 1.4 },
      { matchId: 2, market: 'Goals Over/Under', selection: 'Over 1.5', probability: 0.62, odds: 1.5 },
    ];
    const result = buildLowRiskParlays(lowProbLegs, { minLegProbability: 0.6, minCumulativeProbability: 0.85 });
    // 0.65*0.62=0.403, muy por debajo del umbral
    assert.equal(result.bestParlay, null);
    assert.equal(result.alternatives.length, 0);
  });

  test('buildLowRiskParlays: alternatives están ordenadas por mejor cuota combinada descendente', () => {
    const legsPool = [
      { matchId: 1, market: 'Double Chance', selection: 'Home/Draw', probability: 0.92, odds: 1.22 },
      { matchId: 2, market: 'Goals Over/Under', selection: 'Over 1.5', probability: 0.91, odds: 1.28 },
      { matchId: 3, market: 'Both Teams Score', selection: 'Yes', probability: 0.9, odds: 1.33 },
      { matchId: 4, market: 'Double Chance', selection: 'Away/Draw', probability: 0.89, odds: 1.4 },
    ];
    const result = buildLowRiskParlays(legsPool, { minLegProbability: 0.6, minCumulativeProbability: 0.7 });

    for (let i = 1; i < result.alternatives.length; i += 1) {
      assert.ok(result.alternatives[i - 1].combinedOdds >= result.alternatives[i].combinedOdds);
    }
  });
});
