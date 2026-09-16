const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { computeBlendedRates, estimateExpectedGoals } = require('../../src/analytics/xgEstimator');

describe('xgEstimator', () => {
  test('computeBlendedRates: sin partidos devuelve null y sampleSize 0', () => {
    const result = computeBlendedRates([]);
    assert.equal(result.blendedGoalsFor, null);
    assert.equal(result.blendedGoalsAgainst, null);
    assert.equal(result.sampleSize, 0);
  });

  test('computeBlendedRates: sin datos de xG, usa 100% goles reales', () => {
    const matches = [
      { goalsFor: 2, goalsAgainst: 1, xgFor: null, xgAgainst: null },
      { goalsFor: 0, goalsAgainst: 0, xgFor: null, xgAgainst: null },
    ];
    const result = computeBlendedRates(matches, { xgWeight: 0.6 });
    assert.equal(result.blendedGoalsFor, 1); // avg(2,0)
    assert.equal(result.blendedGoalsAgainst, 0.5); // avg(1,0)
  });

  test('computeBlendedRates: mezcla xG y goles reales según xgWeight', () => {
    const matches = [{ goalsFor: 2, goalsAgainst: 0, xgFor: 1.0, xgAgainst: 0.5 }];
    const result = computeBlendedRates(matches, { xgWeight: 0.6 });
    // blended = 0.6*xg + 0.4*goals
    assert.ok(Math.abs(result.blendedGoalsFor - (0.6 * 1.0 + 0.4 * 2)) < 1e-9);
    assert.ok(Math.abs(result.blendedGoalsAgainst - (0.6 * 0.5 + 0.4 * 0)) < 1e-9);
  });

  test('estimateExpectedGoals: equipo con fuerza de liga promedio devuelve xG ~ promedio de liga', () => {
    // 5 partidos anotando exactamente el promedio de la liga -> fuerza = 1 -> xG = promedio liga
    const avgMatches = (goals, conceded) =>
      Array.from({ length: 5 }, () => ({ goalsFor: goals, goalsAgainst: conceded, xgFor: null, xgAgainst: null }));

    const result = estimateExpectedGoals({
      homeTeamHomeMatches: avgMatches(1.5, 1.15),
      awayTeamAwayMatches: avgMatches(1.15, 1.5),
      leagueAvgHomeGoals: 1.5,
      leagueAvgAwayGoals: 1.15,
    });

    assert.ok(Math.abs(result.homeXG - 1.5) < 1e-6);
    assert.ok(Math.abs(result.awayXG - 1.15) < 1e-6);
  });

  test('estimateExpectedGoals: equipo local fuerte vs visitante débil produce homeXG > awayXG', () => {
    const strongHome = Array.from({ length: 6 }, () => ({ goalsFor: 3, goalsAgainst: 0.5, xgFor: 2.8, xgAgainst: 0.6 }));
    const weakAway = Array.from({ length: 6 }, () => ({ goalsFor: 0.5, goalsAgainst: 2.5, xgFor: 0.6, xgAgainst: 2.3 }));

    const result = estimateExpectedGoals({
      homeTeamHomeMatches: strongHome,
      awayTeamAwayMatches: weakAway,
      leagueAvgHomeGoals: 1.5,
      leagueAvgAwayGoals: 1.15,
    });

    assert.ok(result.homeXG > result.awayXG);
    assert.ok(result.homeAttackStrength > 1);
    assert.ok(result.awayAttackStrength < 1);
  });

  test('estimateExpectedGoals: sin historial (equipo nuevo) cae a fuerza de liga promedio (1.0)', () => {
    const result = estimateExpectedGoals({
      homeTeamHomeMatches: [],
      awayTeamAwayMatches: [],
      leagueAvgHomeGoals: 1.5,
      leagueAvgAwayGoals: 1.15,
    });

    assert.equal(result.homeAttackStrength, 1);
    assert.equal(result.awayDefenseStrength, 1);
    assert.ok(Math.abs(result.homeXG - 1.5) < 1e-9);
    assert.ok(Math.abs(result.awayXG - 1.15) < 1e-9);
  });

  test('estimateExpectedGoals rechaza promedios de liga <= 0', () => {
    assert.throws(() =>
      estimateExpectedGoals({
        homeTeamHomeMatches: [],
        awayTeamAwayMatches: [],
        leagueAvgHomeGoals: 0,
        leagueAvgAwayGoals: 1.15,
      })
    );
  });
});
