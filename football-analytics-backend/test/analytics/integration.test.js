/**
 * Prueba de integración de la Fase 2: encadena xG -> Poisson bivariada ->
 * Value Betting -> Generador de parlays -> Kelly, con datos sintéticos
 * (sin tocar la base de datos), para validar que los módulos se combinan
 * de forma matemáticamente consistente de punta a punta.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { estimateExpectedGoals } = require('../../src/analytics/xgEstimator');
const { predictMatch } = require('../../src/analytics/poissonModel');
const { findValueBets } = require('../../src/analytics/valueBettingEngine');
const { buildLowRiskParlays } = require('../../src/analytics/parlayBuilder');
const { calculateRecommendedStake, recommendBankrollAllocation } = require('../../src/analytics/kellyCriterion');

function repeatedMatches(n, goalsFor, goalsAgainst, xgFor, xgAgainst) {
  return Array.from({ length: n }, () => ({ goalsFor, goalsAgainst, xgFor, xgAgainst }));
}

describe('Integración Fase 2: motor de probabilidades y gestión de riesgo', () => {
  test('pipeline completo: xG -> Poisson -> Value Betting -> stake de Kelly', () => {
    // Equipo local en gran forma, visitante flojo de visitante.
    const homeXgEstimate = estimateExpectedGoals({
      homeTeamHomeMatches: repeatedMatches(8, 2.2, 0.6, 2.0, 0.7),
      awayTeamAwayMatches: repeatedMatches(8, 0.7, 1.9, 0.8, 1.8),
      leagueAvgHomeGoals: 1.5,
      leagueAvgAwayGoals: 1.15,
    });

    assert.ok(homeXgEstimate.homeXG > homeXgEstimate.awayXG);

    const prediction = predictMatch({ homeXG: homeXgEstimate.homeXG, awayXG: homeXgEstimate.awayXG });
    assert.ok(Math.abs(prediction.markets.homeWin + prediction.markets.draw + prediction.markets.awayWin - 1) < 1e-9);

    // El bookmaker infravalora al local (cuota generosa para nuestra probabilidad calculada).
    const marketOdds = [
      { market: 'Match Winner', selection: 'Home', oddsDecimal: 1.6, bookmaker: 'BookA' },
      { market: 'Match Winner', selection: 'Away', oddsDecimal: 5.5, bookmaker: 'BookA' },
    ];

    // maxEdge alto a propósito: este test usa una cuota deliberadamente generosa
    // (edge ~28%) para validar el pipeline completo, no el tope de maxEdge en sí
    // (ver valueBettingEngine.test.js para ese caso, y config.api.maxEdge=0.20 por defecto).
    const valueBets = findValueBets(prediction.markets, marketOdds, { minEdge: 0.05, maxEdge: 1 });
    assert.ok(valueBets.length >= 1);

    const bestBet = valueBets[0];
    const stake = calculateRecommendedStake({
      probability: bestBet.ourProbability,
      decimalOdds: bestBet.oddsDecimal,
      bankroll: 1000,
      kellyMultiplier: 0.25,
    });

    assert.equal(stake.recommendation, 'bet');
    assert.ok(stake.recommendedStake > 0);
    assert.ok(stake.recommendedFraction <= 0.05); // respeta el tope por defecto
  });

  test('pipeline de parlay: partidos de alta probabilidad producen un paquete > 85% y su stake de Kelly fraccionado', () => {
    // Nota: para que el producto de N probabilidades supere 0.85, cada leg individual
    // debe ser bastante alta (ej. dos legs de ~0.95 cada una: 0.95*0.95=0.9025 > 0.85).
    const candidateLegs = [
      { matchId: 101, market: 'Double Chance', selection: 'Home/Draw', probability: 0.96, odds: 1.15 },
      { matchId: 102, market: 'Goals Over/Under', selection: 'Over 1.5', probability: 0.95, odds: 1.2 },
      { matchId: 103, market: 'Both Teams Score', selection: 'Yes', probability: 0.93, odds: 1.28 },
      { matchId: 104, market: 'Double Chance', selection: 'Away/Draw', probability: 0.7, odds: 1.55 },
    ];

    const { bestParlay, alternatives } = buildLowRiskParlays(candidateLegs, {
      minLegProbability: 0.65,
      minCumulativeProbability: 0.85,
    });

    assert.ok(bestParlay.cumulativeProbability > 0.85);
    assert.ok(bestParlay.combinedOdds > 1);

    // El paquete se trata como una sola "apuesta" para efectos de Kelly.
    const stake = calculateRecommendedStake({
      probability: bestParlay.cumulativeProbability,
      decimalOdds: bestParlay.combinedOdds,
      bankroll: 500,
      kellyMultiplier: 0.25,
    });

    assert.ok(stake.recommendedStake >= 0);
    assert.ok(alternatives.every((alt) => alt.cumulativeProbability > 0.85));
  });

  test('pipeline de bankroll: múltiples paquetes simultáneos respetan el tope de exposición agregada', () => {
    const packages = [
      { id: 'parlay-1', probability: 0.88, decimalOdds: 1.9 },
      { id: 'parlay-2', probability: 0.86, decimalOdds: 2.1 },
      { id: 'value-bet-1', probability: 0.6, decimalOdds: 2.0 },
    ];

    const allocation = recommendBankrollAllocation(packages, {
      bankroll: 2000,
      kellyMultiplier: 0.5,
      maxStakeFraction: 0.08,
      maxTotalExposureFraction: 0.15,
    });

    const totalFraction = allocation.bets.reduce((sum, b) => sum + b.recommendedFraction, 0);
    assert.ok(totalFraction <= 0.15 + 1e-9);
    assert.equal(allocation.bets.length, 3);
  });
});
