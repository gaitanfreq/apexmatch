const cron = require('node-cron');
const logger = require('../utils/logger');
const config = require('../config');
const { syncOddsForUpcomingMatches, markClosingLines } = require('../ingestion/syncOdds');
const { syncLineupsForImminentMatches } = require('../ingestion/syncLineups');
const { syncFixturesForLeagueSeason } = require('../ingestion/syncFixtures');
const { syncInjuriesForLeagueSeason } = require('../ingestion/syncInjuries');
const { simulateTick } = require('../ingestion/matchSimulator');
const { refreshPredictionsCache } = require('../ingestion/predictionsRefresh');

/**
 * Ejecuta un job programado protegido contra solapamiento (si la corrida anterior
 * sigue viva, se salta la siguiente) y contra excepciones no controladas.
 */
function scheduleGuarded(name, cronExpr, task) {
  let running = false;
  cron.schedule(cronExpr, async () => {
    if (running) {
      logger.warn(`[cron:${name}] previous run still in progress, skipping this tick`);
      return;
    }
    running = true;
    logger.info(`[cron:${name}] starting`);
    try {
      await task();
      logger.info(`[cron:${name}] completed`);
    } catch (err) {
      // El job individual ya registra sus propios fallos parciales en ingestion_errors;
      // esto captura únicamente fallos catastróficos (API caída, DB inaccesible, etc).
      logger.error(`[cron:${name}] fatal error`, { error: err.message });
    } finally {
      running = false;
    }
  });
  logger.info(`[cron:${name}] scheduled with expression "${cronExpr}"`);
}

function startCronJobs() {
  if (config.matchDataSource === 'simulator') {
    // Sin API_FOOTBALL_KEY real: el simulador alimenta partidos/cuotas de
    // Champions League, La Liga, Premier League y Serie A automáticamente.
    scheduleGuarded('match-simulator', '*/5 * * * *', simulateTick);
    logger.info('MATCH_DATA_SOURCE=simulator -> usando el simulador automatizado de partidos (no se programaron los jobs de API-Football).');
  } else {
    // Cuotas: 1 request de API-Football por partido programado en la ventana —
    // con 8 ligas puede haber ~20-40 partidos próximos simultáneos, así que
    // cada 5 min (como en el simulador, donde no cuesta cuota real) fácilmente
    // superaría los 7,500 req/día del plan Pro (288 corridas/día × ~30
    // partidos ≈ 8,640). Cada 30 min mantiene esto en un presupuesto seguro
    // (~48 corridas/día × ~30 ≈ 1,440) con margen para los demás jobs.
    scheduleGuarded('odds-poller', '*/30 * * * *', () =>
      syncOddsForUpcomingMatches({ withinHours: 72 })
    );

    // Cierre de cuotas (closing line): solo actualiza filas ya guardadas —
    // no llama a la API, así que corre cada minuto sin costo de cuota.
    scheduleGuarded('closing-line-marker', '* * * * *', markClosingLines);

    // Alineaciones confirmadas: el propio filtro (kickoff en <90min) ya acota
    // el volumen a muy pocos partidos por corrida, así que cada 5 min alcanza
    // sin necesitar la granularidad de cada 2 min.
    scheduleGuarded('lineups-poller', '*/5 * * * *', () =>
      syncLineupsForImminentMatches({ withinMinutes: 90 })
    );

    // Fixtures (resultados, nuevos partidos programados, cambios de horario): cada hora.
    scheduleGuarded('fixtures-refresh', '0 * * * *', async () => {
      for (const leagueId of config.trackedLeagueIds) {
        await syncFixturesForLeagueSeason(leagueId, config.currentSeasonYear);
      }
    });

    // Lesiones/sanciones: cada 6 horas (cambia con menor frecuencia que odds/lineups).
    scheduleGuarded('injuries-refresh', '0 */6 * * *', async () => {
      for (const leagueId of config.trackedLeagueIds) {
        await syncInjuriesForLeagueSeason(leagueId, config.currentSeasonYear);
      }
    });
  }

  // Motor de probabilidades (xG + Poisson + value bets, Fase 2) sobre los
  // partidos programados — independiente de la fuente de datos (simulador o
  // API-Football real). Alimenta match_predictions_cache, que leen las
  // vistas de Value Bets / Live Predictions (ver matchdayService.js).
  scheduleGuarded('predictions-refresh', '*/5 * * * *', () =>
    refreshPredictionsCache({ withinHours: 72 })
  );

  logger.info('All cron jobs scheduled.');
}

module.exports = { startCronJobs };
