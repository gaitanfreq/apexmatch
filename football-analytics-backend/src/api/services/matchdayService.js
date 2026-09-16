/**
 * Capa de orquestación de la API: toma los fixtures próximos y los motores
 * analíticos de la Fase 2 (xG, Poisson, value betting, parlays, Kelly) y
 * produce las estructuras que consumen los endpoints REST.
 */
const analyticsRepo = require('../../repositories/analyticsRepository');
const statsRepo = require('../../repositories/statsRepository');
const predictionsCacheRepo = require('../../repositories/predictionsCacheRepository');
const { predictFixture } = require('../../analytics/predictMatch');
const { resolveModelProbability } = require('../../analytics/valueBettingEngine');
const { buildLowRiskParlays } = require('../../analytics/parlayBuilder');
const { calculateRecommendedStake } = require('../../analytics/kellyCriterion');
const { computePerformanceStats } = require('../../analytics/performanceStats');
const config = require('../../config');
const logger = require('../../utils/logger');

const PREDICTIONS_CACHE_MAX_AGE_MINUTES = 30;

/**
 * Predicción de un fixture leyendo primero de `match_predictions_cache`
 * (poblada automáticamente por el job `predictions-refresh`, ver
 * src/ingestion/predictionsRefresh.js). Si no hay una entrada reciente —
 * partido nuevo que el cron todavía no procesó, o el cron no está corriendo
 * en este entorno — calcula en vivo y "calienta" la caché para la próxima
 * consulta, así el endpoint nunca depende ciegamente del cron para responder.
 */
async function predictFixtureCached(fixture) {
  const cached = await predictionsCacheRepo.getByMatchId(fixture.id, {
    maxAgeMinutes: PREDICTIONS_CACHE_MAX_AGE_MINUTES,
  });

  if (cached) {
    return {
      fixture,
      xgEstimate: { homeXG: cached.homeXg, awayXG: cached.awayXg },
      prediction: { markets: cached.markets, topScores: cached.topScores },
      valueBets: cached.valueBets,
    };
  }

  const result = await predictFixture(fixture, { minEdge: config.api.minEdge });

  predictionsCacheRepo
    .upsert(fixture.id, {
      homeXg: result.xgEstimate.homeXG,
      awayXg: result.xgEstimate.awayXG,
      markets: result.prediction.markets,
      topScores: result.prediction.topScores,
      valueBets: result.valueBets,
    })
    .catch((err) => logger.warn(`No se pudo precalentar la caché de predicciones para fixture ${fixture.id}: ${err.message}`));

  return result;
}

/** Predicciones completas para los fixtures dentro de la ventana de horas dada. */
async function getPredictions({ withinHours = 24, leagueIds = [] } = {}) {
  const fixtures = await analyticsRepo.getUpcomingFixtures({ withinHours, leagueIds });

  const predictions = [];
  for (const fixture of fixtures) {
    try {
      const result = await predictFixtureCached(fixture);
      predictions.push(result);
    } catch (err) {
      logger.warn(`Skipping fixture ${fixture.id} in predictions: ${err.message}`);
    }
  }
  return predictions;
}

/**
 * Construye candidatos de "leg" de alta probabilidad (Doble Oportunidad,
 * Over 1.5, Ambos Anotan) para cada fixture próximo, cruzando nuestras
 * probabilidades de mercado con la mejor cuota disponible por selección.
 */
async function buildParlayLegCandidates({ withinHours = 72, leagueIds = [] } = {}) {
  const fixtures = await analyticsRepo.getUpcomingFixtures({ withinHours, leagueIds });
  const candidates = [];

  for (const fixture of fixtures) {
    let prediction;
    try {
      prediction = await predictFixtureCached(fixture);
    } catch (err) {
      logger.warn(`Skipping fixture ${fixture.id} in parlay candidates: ${err.message}`);
      continue;
    }

    const marketOdds = await analyticsRepo.getLatestOddsForMatch(fixture.id);

    for (const quote of marketOdds) {
      const probability = resolveModelProbability(prediction.prediction.markets, quote.market, quote.selection, quote.handicap);
      if (probability == null) continue;

      candidates.push({
        matchId: fixture.id,
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        homeTeamName: fixture.homeTeamName,
        awayTeamName: fixture.awayTeamName,
        kickoffAt: fixture.kickoffAt,
        market: quote.market,
        selection: quote.selection,
        bookmaker: quote.bookmaker,
        probability,
        odds: quote.oddsDecimal,
      });
    }
  }

  return candidates;
}

/** Paquetes combinados de bajo riesgo (>85% de probabilidad acumulada proyectada) con su stake de Kelly. */
async function getLowRiskPackages({ withinHours = 72, leagueIds = [] } = {}) {
  const candidates = await buildParlayLegCandidates({ withinHours, leagueIds });

  const { bestParlay, alternatives, eligibleLegCount } = buildLowRiskParlays(candidates, {
    minLegProbability: 0.6,
    minCumulativeProbability: config.api.minParlayCumulativeProbability,
  });

  const attachStake = (pkg) => ({
    ...pkg,
    riskLevel: 'low',
    kellyStake: calculateRecommendedStake({
      probability: pkg.cumulativeProbability,
      decimalOdds: pkg.combinedOdds,
      bankroll: config.api.defaultBankroll,
      kellyMultiplier: config.api.kellyMultiplier,
    }),
  });

  return {
    eligibleLegCount,
    bestPackage: bestParlay ? attachStake(bestParlay) : null,
    alternatives: alternatives.map(attachStake),
  };
}

/** Todas las cuotas con edge >= minEdge detectadas en los próximos fixtures (contenido VIP). */
async function getValueBets({ withinHours = 72, leagueIds = [], minEdge = config.api.minEdge } = {}) {
  const predictions = await getPredictions({ withinHours, leagueIds });

  const valueBets = predictions
    .flatMap((p) => p.valueBets.map((vb) => ({
      ...vb,
      matchId: p.fixture.id,
      homeTeamId: p.fixture.homeTeamId,
      awayTeamId: p.fixture.awayTeamId,
      homeTeamName: p.fixture.homeTeamName,
      awayTeamName: p.fixture.awayTeamName,
      kickoffAt: p.fixture.kickoffAt,
    })))
    .filter((vb) => vb.edge >= minEdge)
    .sort((a, b) => b.edge - a.edge)
    .map((vb) => ({
      ...vb,
      riskLevel: 'high',
      kellyStake: calculateRecommendedStake({
        probability: vb.ourProbability,
        decimalOdds: vb.oddsDecimal,
        bankroll: config.api.defaultBankroll,
        kellyMultiplier: config.api.kellyMultiplier,
      }),
    }));

  return valueBets;
}

/** Métricas históricas de rendimiento (ROI, % aciertos, curva de bankroll) — contenido público. */
async function getPerformanceStats() {
  const history = await statsRepo.getSettledHistory();
  return computePerformanceStats(history, { startingBankroll: config.api.defaultBankroll });
}

/** Ligas trackeadas con partidos en la base, para el filtro de Live Predictions. */
async function getTrackedLeagues() {
  return analyticsRepo.getTrackedLeagues();
}

/**
 * Vista general de Live Predictions: partidos programados, en juego y/o
 * finalizados (según `statuses`), filtrables por liga. Solo se corre el
 * motor de predicción (xG/Poisson/value bets) para partidos 'scheduled' —
 * "predecir" un partido en juego o ya terminado no tiene sentido: para esos
 * se devuelve únicamente la info básica (equipos, liga, estado, marcador).
 */
async function getFixturesOverview({ withinHours = 48, leagueIds = [], statuses = ['scheduled', 'live'] } = {}) {
  const fixtures = await analyticsRepo.getFixtures({ withinHours, leagueIds, statuses });

  const overview = [];
  for (const fixture of fixtures) {
    if (fixture.status !== 'scheduled') {
      overview.push({ fixture, xgEstimate: null, prediction: null, valueBets: [] });
      continue;
    }

    try {
      const result = await predictFixtureCached(fixture);
      overview.push(result);
    } catch (err) {
      logger.warn(`Skipping fixture ${fixture.id} in fixtures overview: ${err.message}`);
      overview.push({ fixture, xgEstimate: null, prediction: null, valueBets: [] });
    }
  }
  return overview;
}

module.exports = {
  getPredictions,
  getLowRiskPackages,
  getValueBets,
  getPerformanceStats,
  getTrackedLeagues,
  getFixturesOverview,
};
