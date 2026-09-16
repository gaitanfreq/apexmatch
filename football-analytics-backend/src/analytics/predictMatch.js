/**
 * Orquestador: conecta la capa de datos (Fase 1) con los módulos matemáticos
 * puros de analítica (xgEstimator + poissonModel + valueBettingEngine) para
 * producir, dado un partido en la base de datos, la predicción completa y
 * las oportunidades de value betting detectadas.
 */
const analyticsRepo = require('../repositories/analyticsRepository');
const { estimateExpectedGoals } = require('./xgEstimator');
const { predictMatch: runPoissonModel } = require('./poissonModel');
const { findValueBets } = require('./valueBettingEngine');
const logger = require('../utils/logger');

const FALLBACK_LEAGUE_AVG_HOME_GOALS = 1.5;
const FALLBACK_LEAGUE_AVG_AWAY_GOALS = 1.15;

/**
 * Genera la predicción completa (xG, marcadores, mercados) para un partido,
 * y opcionalmente la cruza contra las cuotas disponibles para detectar value bets.
 *
 * @param {object} fixture - { id, leagueId, seasonId, homeTeamId, awayTeamId }
 * @param {object} [options]
 * @param {number} [options.recentMatchesLimit=10]
 * @param {number} [options.minEdge=0.05]
 * @param {number} [options.maxEdge=0.20]
 */
async function predictFixture(fixture, { recentMatchesLimit = 10, minEdge = 0.05, maxEdge = 0.2 } = {}) {
  const [homeTeamHomeMatches, awayTeamAwayMatches, leagueAverages] = await Promise.all([
    analyticsRepo.getRecentHomeMatches(fixture.homeTeamId, { limit: recentMatchesLimit }),
    analyticsRepo.getRecentAwayMatches(fixture.awayTeamId, { limit: recentMatchesLimit }),
    analyticsRepo.getLeagueAverages(fixture.leagueId, fixture.seasonId),
  ]);

  const leagueAvgHomeGoals = leagueAverages.avgHomeGoals ?? FALLBACK_LEAGUE_AVG_HOME_GOALS;
  const leagueAvgAwayGoals = leagueAverages.avgAwayGoals ?? FALLBACK_LEAGUE_AVG_AWAY_GOALS;

  if (leagueAverages.avgHomeGoals == null) {
    logger.warn('No finished matches for league averages yet, using fallback averages', {
      leagueId: fixture.leagueId,
      seasonId: fixture.seasonId,
    });
  }

  const xgEstimate = estimateExpectedGoals({
    homeTeamHomeMatches,
    awayTeamAwayMatches,
    leagueAvgHomeGoals,
    leagueAvgAwayGoals,
  });

  const prediction = runPoissonModel({ homeXG: xgEstimate.homeXG, awayXG: xgEstimate.awayXG });

  const marketOdds = await analyticsRepo.getLatestOddsForMatch(fixture.id);
  const valueBets = findValueBets(prediction.markets, marketOdds, { minEdge, maxEdge });

  return { fixture, xgEstimate, prediction, valueBets };
}

module.exports = { predictFixture };
