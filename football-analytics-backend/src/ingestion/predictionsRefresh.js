/**
 * Ejecuta automáticamente el motor de probabilidades (xG + Poisson Bivariada
 * + detección de value bets, Fase 2) sobre los partidos programados, y
 * guarda el resultado en `match_predictions_cache` (migración 010).
 *
 * Las vistas de "Value Bets" y "Live Predictions" (API, Fase 3) leen de esta
 * caché en vez de recalcular en cada request — ver
 * `src/api/services/matchdayService.js#predictFixtureCached`. Si la caché
 * está vacía o vencida (ej. este job no corrió todavía), esas rutas calculan
 * en vivo igual, así que nunca dependen ciegamente de que el cron esté arriba.
 */
const analyticsRepo = require('../repositories/analyticsRepository');
const predictionsCacheRepo = require('../repositories/predictionsCacheRepository');
const { predictFixture } = require('../analytics/predictMatch');
const { runJob } = require('./runJob');
const config = require('../config');

async function refreshPredictionsCache({ withinHours = 72, leagueIds = [] } = {}) {
  return runJob(
    'predictions_refresh',
    async (ctx) => {
      const fixtures = await analyticsRepo.getUpcomingFixtures({ withinHours, leagueIds });

      for (const fixture of fixtures) {
        try {
          const result = await predictFixture(fixture, { minEdge: config.api.minEdge });
          await predictionsCacheRepo.upsert(fixture.id, {
            homeXg: result.xgEstimate.homeXG,
            awayXg: result.xgEstimate.awayXG,
            markets: result.prediction.markets,
            topScores: result.prediction.topScores,
            valueBets: result.valueBets,
          });
          ctx.trackProcessed(1);
        } catch (err) {
          await ctx.reportError('prediction', fixture.id, err);
        }
      }
    },
    { withinHours, leagueIds }
  );
}

module.exports = { refreshPredictionsCache };
