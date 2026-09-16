#!/usr/bin/env node
/**
 * Complemento de seed-demo-data.js: agrega 2 ligas adicionales (reutilizando
 * los mismos equipos demo) para poder probar/demostrar el filtro por liga de
 * Live Predictions con más de una opción. Solo para desarrollo/demo local.
 */
const { pool, query, withTransaction } = require('../src/db/pool');
const logger = require('../src/utils/logger');

const EXTRA_LEAGUES = [
  { providerLeagueId: 999002, name: 'Copa Elite Demo' },
  { providerLeagueId: 999003, name: 'Liga Premier Demo' },
];

async function seed() {
  await withTransaction(async (client) => {
    const { rows: countryRows } = await client.query("SELECT id FROM countries WHERE name = 'Demolandia'");
    const countryId = countryRows[0]?.id;

    const { rows: teamRows } = await client.query(
      "SELECT id, provider_team_id AS \"providerTeamId\" FROM teams WHERE provider_team_id BETWEEN 900000 AND 900010 ORDER BY id"
    );
    if (teamRows.length < 4) {
      throw new Error('Corré primero npm run seed:demo (se necesitan los equipos demo).');
    }
    const [teamA, teamB, teamC, teamD] = teamRows;

    let fixtureCounter = 810000;

    for (const league of EXTRA_LEAGUES) {
      const { rows: leagueRows } = await client.query(
        `INSERT INTO leagues (provider_league_id, name, type, country_id)
         VALUES ($1, $2, 'league', $3)
         ON CONFLICT (provider_league_id) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [league.providerLeagueId, league.name, countryId]
      );
      const leagueId = leagueRows[0].id;

      const seasonYear = new Date().getFullYear();
      const { rows: seasonRows } = await client.query(
        `INSERT INTO seasons (league_id, year, start_date, end_date, is_current)
         VALUES ($1, $2, now() - interval '30 days', now() + interval '90 days', true)
         ON CONFLICT (league_id, year) DO UPDATE SET is_current = true
         RETURNING id`,
        [leagueId, seasonYear]
      );
      const seasonId = seasonRows[0].id;

      const upcomingPairs = [
        [teamA, teamB, 10],
        [teamC, teamD, 26],
      ];

      for (const [home, away, hoursFromNow] of upcomingPairs) {
        await client.query(
          `INSERT INTO matches (
             provider_fixture_id, league_id, season_id, home_team_id, away_team_id,
             round, kickoff_at, status, status_detail
           )
           VALUES ($1,$2,$3,$4,$5,'Jornada Próxima', now() + ($6 || ' hours')::interval, 'scheduled', 'NS')
           ON CONFLICT (provider_fixture_id) DO UPDATE SET kickoff_at = EXCLUDED.kickoff_at
           RETURNING id`,
          [fixtureCounter, leagueId, seasonId, home.id, away.id, hoursFromNow]
        );
        fixtureCounter += 1;
      }

      logger.info(`Liga "${league.name}" lista con ${upcomingPairs.length} partidos próximos.`);
    }
  });
}

seed()
  .then(() => logger.info('Ligas adicionales de demo sembradas correctamente.'))
  .catch((err) => {
    logger.error('Fallo el seed de ligas adicionales', { error: err.message });
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
