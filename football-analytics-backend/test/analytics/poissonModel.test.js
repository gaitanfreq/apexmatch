const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  poissonPmf,
  factorial,
  deriveBivariateLambdas,
  bivariatePoissonPmf,
  buildScoreMatrix,
  overProbability,
  underProbability,
  bttsYesProbability,
  topCorrectScores,
  aggregateMarketProbabilities,
  predictMatch,
} = require('../../src/analytics/poissonModel');

function sumMatrix(matrix) {
  return matrix.reduce((sum, row) => sum + row.reduce((s, p) => s + p, 0), 0);
}

describe('poissonModel: fundamentos matemáticos', () => {
  test('factorial de valores conocidos', () => {
    assert.equal(factorial(0), 1);
    assert.equal(factorial(1), 1);
    assert.equal(factorial(5), 120);
  });

  test('poissonPmf: P(X=0) para lambda=1 es e^-1', () => {
    assert.ok(Math.abs(poissonPmf(1, 0) - Math.exp(-1)) < 1e-9);
  });

  test('poissonPmf: las probabilidades para k=0..30 suman ~1 (cola despreciable)', () => {
    const lambda = 2.3;
    let total = 0;
    for (let k = 0; k <= 30; k += 1) total += poissonPmf(lambda, k);
    assert.ok(Math.abs(total - 1) < 1e-9);
  });

  test('poissonPmf: k negativo o no entero devuelve 0', () => {
    assert.equal(poissonPmf(1, -1), 0);
    assert.equal(poissonPmf(1, 1.5), 0);
  });

  test('deriveBivariateLambdas preserva las medias marginales', () => {
    const { lambda1, lambda2, lambda3 } = deriveBivariateLambdas(1.8, 1.2, 0.15);
    assert.ok(Math.abs(lambda1 + lambda3 - 1.8) < 1e-9);
    assert.ok(Math.abs(lambda2 + lambda3 - 1.2) < 1e-9);
    assert.ok(lambda3 >= 0);
  });

  test('deriveBivariateLambdas: correlation=0 produce independencia total (lambda3=0)', () => {
    const { lambda1, lambda2, lambda3 } = deriveBivariateLambdas(1.8, 1.2, 0);
    assert.equal(lambda3, 0);
    assert.equal(lambda1, 1.8);
    assert.equal(lambda2, 1.2);
  });

  test('deriveBivariateLambdas rechaza xG negativo o correlation fuera de rango', () => {
    assert.throws(() => deriveBivariateLambdas(-1, 1, 0.1));
    assert.throws(() => deriveBivariateLambdas(1, 1, 1));
    assert.throws(() => deriveBivariateLambdas(1, 1, -0.1));
  });

  test('bivariatePoissonPmf con lambda3=0 colapsa al producto de dos Poisson independientes', () => {
    const l1 = 1.4;
    const l2 = 0.9;
    for (const [x, y] of [[0, 0], [1, 2], [3, 1], [2, 2]]) {
      const bivariate = bivariatePoissonPmf(x, y, l1, l2, 0);
      const independent = poissonPmf(l1, x) * poissonPmf(l2, y);
      assert.ok(Math.abs(bivariate - independent) < 1e-9, `mismatch at (${x},${y})`);
    }
  });

  test('buildScoreMatrix produce una distribución de probabilidad válida (suma ~1, todo >= 0)', () => {
    const matrix = buildScoreMatrix({ homeXG: 1.7, awayXG: 1.1, correlation: 0.12, maxGoals: 10 });
    assert.ok(Math.abs(sumMatrix(matrix) - 1) < 1e-9);
    for (const row of matrix) {
      for (const p of row) assert.ok(p >= 0);
    }
  });

  test('buildScoreMatrix rechaza maxGoals inválido', () => {
    assert.throws(() => buildScoreMatrix({ homeXG: 1, awayXG: 1, maxGoals: 0 }));
    assert.throws(() => buildScoreMatrix({ homeXG: 1, awayXG: 1, maxGoals: 2.5 }));
  });

  test('overProbability + underProbability suman 1 para cualquier línea', () => {
    const matrix = buildScoreMatrix({ homeXG: 1.5, awayXG: 1.3 });
    for (const line of [0.5, 1.5, 2.5, 3.5]) {
      const over = overProbability(matrix, line);
      const under = underProbability(matrix, line);
      assert.ok(Math.abs(over + under - 1) < 1e-9);
    }
  });

  test('bttsYesProbability es 0 cuando uno de los equipos tiene xG ~0', () => {
    const matrix = buildScoreMatrix({ homeXG: 2.0, awayXG: 0.0001, maxGoals: 10 });
    assert.ok(bttsYesProbability(matrix) < 0.01);
  });

  test('topCorrectScores devuelve marcadores ordenados descendentemente por probabilidad', () => {
    const matrix = buildScoreMatrix({ homeXG: 1.6, awayXG: 1.1 });
    const top = topCorrectScores(matrix, 5);
    assert.equal(top.length, 5);
    for (let i = 1; i < top.length; i += 1) {
      assert.ok(top[i - 1].probability >= top[i].probability);
    }
  });

  test('aggregateMarketProbabilities: 1X2 suma 1 y equipo con xG muy superior favorece homeWin', () => {
    const matrix = buildScoreMatrix({ homeXG: 3.0, awayXG: 0.4 });
    const markets = aggregateMarketProbabilities(matrix);
    assert.ok(Math.abs(markets.homeWin + markets.draw + markets.awayWin - 1) < 1e-9);
    assert.ok(markets.homeWin > 0.7, `expected dominant home win, got ${markets.homeWin}`);
    assert.ok(markets.homeWin > markets.awayWin);
  });

  test('aggregateMarketProbabilities: doble oportunidad es consistente con 1X2', () => {
    const matrix = buildScoreMatrix({ homeXG: 1.4, awayXG: 1.4 });
    const m = aggregateMarketProbabilities(matrix);
    assert.ok(Math.abs(m.doubleChance.homeOrDraw - (m.homeWin + m.draw)) < 1e-9);
    assert.ok(Math.abs(m.doubleChance.awayOrDraw - (m.draw + m.awayWin)) < 1e-9);
    assert.ok(Math.abs(m.doubleChance.homeOrAway - (m.homeWin + m.awayWin)) < 1e-9);
  });

  test('aggregateMarketProbabilities: partido simétrico (mismo xG) tiene homeWin ~ awayWin', () => {
    const matrix = buildScoreMatrix({ homeXG: 1.3, awayXG: 1.3, correlation: 0 });
    const m = aggregateMarketProbabilities(matrix);
    assert.ok(Math.abs(m.homeWin - m.awayWin) < 1e-6);
  });

  test('predictMatch integra matrix + markets + topScores de forma coherente', () => {
    const result = predictMatch({ homeXG: 1.8, awayXG: 1.0 });
    assert.ok(result.matrix.length > 0);
    assert.ok(Math.abs(result.markets.homeWin + result.markets.draw + result.markets.awayWin - 1) < 1e-9);
    assert.equal(result.topScores.length, 5);
    assert.equal(result.topScores[0].probability, Math.max(...result.matrix.flat()));
  });
});
