#!/usr/bin/env node
/**
 * Backfill inicial: sincroniza catálogo (ligas/equipos), fixtures históricos
 * y lesiones para todas las ligas trackeadas. Pensado para correrse una vez
 * al inicializar el sistema, o manualmente para agregar una nueva liga/temporada.
 *
 * Uso: node src/ingestion/backfillHistorical.js
 */
const config = require('../config');
const logger = require('../utils/logger');
const { syncCatalog } = require('./syncCatalog');
const { syncFixturesForLeagueSeason } = require('./syncFixtures');
const { syncInjuriesForLeagueSeason } = require('./syncInjuries');
const { pool } = require('../db/pool');

async function main() {
  const { trackedLeagueIds, currentSeasonYear } = config;

  if (trackedLeagueIds.length === 0) {
    logger.error('No leagues configured in TRACKED_LEAGUE_IDS. Aborting backfill.');
    process.exitCode = 1;
    return;
  }

  logger.info('Starting historical backfill', { trackedLeagueIds, currentSeasonYear });

  logger.info('Step 1/3: syncing catalog (leagues, teams, venues)');
  await syncCatalog(trackedLeagueIds, currentSeasonYear);

  for (const leagueId of trackedLeagueIds) {
    logger.info(`Step 2/3: syncing fixtures for league ${leagueId}`);
    try {
      await syncFixturesForLeagueSeason(leagueId, currentSeasonYear);
    } catch (err) {
      logger.error(`Fixtures backfill failed for league ${leagueId}, continuing with next league`, {
        error: err.message,
      });
    }

    logger.info(`Step 3/3: syncing injuries for league ${leagueId}`);
    try {
      await syncInjuriesForLeagueSeason(leagueId, currentSeasonYear);
    } catch (err) {
      logger.error(`Injuries backfill failed for league ${leagueId}, continuing with next league`, {
        error: err.message,
      });
    }
  }

  logger.info('Historical backfill complete.');
}

main()
  .catch((err) => {
    logger.error('Backfill aborted with fatal error', { error: err.message });
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
