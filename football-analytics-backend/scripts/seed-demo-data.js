#!/usr/bin/env node
/**
 * Seed de datos SINTÉTICOS para validar el pipeline completo (xG -> Poisson
 * -> value betting -> parlays -> Kelly -> API -> dashboard) sin depender de
 * una API_FOOTBALL_KEY real. NO usar en producción — está pensado solo para
 * desarrollo/demo local.
 *
 * Crea: 1 liga/temporada, 4 equipos con venues, 12 partidos finalizados
 * (con match_team_stats realistas) para que el xgEstimator tenga historial,
 * 3 fixtures próximos con cuotas de mercado, y un historial de
 * recomendaciones resueltas para poblar /api/stats/performance.
 */
const { pool, query, withTransaction } = require('../src/db/pool');
const logger = require('../src/utils/logger');

const TEAMS = [
  { name: 'Atlético Norte', code: 'ATN', strength: 'strong' }, // buen ataque, buena defensa
  { name: 'Sur United', code: 'SUR', strength: 'weak' }, // ataque flojo, defensa floja
  { name: 'Deportivo Central', code: 'DCE', strength: 'average' },
  { name: 'Costa FC', code: 'CFC', strength: 'average' },
];

const GOAL_PROFILES = {
  strong: { scoredHome: [3, 2, 2, 4, 1, 3], concededHome: [0, 1, 0, 1, 1, 0] },
  weak: { scoredHome: [0, 1, 0, 1, 0, 1], concededHome: [2, 3, 2, 1, 2, 3] },
  average: { scoredHome: [1, 2, 1, 1, 2, 0], concededHome: [1, 1, 2, 0, 1, 2] },
};

async function upsertCountry(client, name) {
  const { rows } = await client.query(
    `INSERT INTO countries (name, code) VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET code = EXCLUDED.code RETURNING id`,
    [name, 'DM']
  );
  return rows[0].id;
}

async function seed() {
  await withTransaction(async (client) => {
    logger.info('Seeding demo league/season...');
    const countryId = await upsertCountry(client, 'Demolandia');

    const { rows: leagueRows } = await client.query(
      `INSERT INTO leagues (provider_league_id, name, type, country_id)
       VALUES (999001, 'Liga Demo', 'league', $1)
       ON CONFLICT (provider_league_id) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [countryId]
    );
    const leagueId = leagueRows[0].id;

    const seasonYear = new Date().getFullYear();
    const { rows: seasonRows } = await client.query(
      `INSERT INTO seasons (league_id, year, start_date, end_date, is_current)
       VALUES ($1, $2, now() - interval '90 days', now() + interval '90 days', true)
       ON CONFLICT (league_id, year) DO UPDATE SET is_current = true
       RETURNING id`,
      [leagueId, seasonYear]
    );
    const seasonId = seasonRows[0].id;

    logger.info('Seeding teams and venues...');
    const teamIds = {};
    for (const team of TEAMS) {
      const { rows: venueRows } = await client.query(
        `INSERT INTO venues (provider_venue_id, name, city, country_id, latitude, longitude, capacity)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (provider_venue_id) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [900000 + Object.keys(teamIds).length, `Estadio ${team.code}`, 'Ciudad Demo', countryId, -34.6, -58.4, 30000]
      );
      const venueId = venueRows[0].id;

      const { rows: teamRows } = await client.query(
        `INSERT INTO teams (provider_team_id, name, short_code, country_id, founded_year, venue_id)
         VALUES ($1, $2, $3, $4, 1950, $5)
         ON CONFLICT (provider_team_id) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [900000 + Object.keys(teamIds).length, team.name, team.code, countryId, venueId]
      );
      teamIds[team.code] = { id: teamRows[0].id, strength: team.strength };
    }

    const codes = TEAMS.map((t) => t.code);

    logger.info('Seeding finished matches with advanced stats...');
    let fixtureCounter = 800000;
    let dayOffset = 60;

    for (let round = 0; round < 3; round += 1) {
      for (let i = 0; i < codes.length; i += 1) {
        for (let j = 0; j < codes.length; j += 1) {
          if (i === j) continue;
          const homeCode = codes[i];
          const awayCode = codes[j];
          const home = teamIds[homeCode];
          const away = teamIds[awayCode];

          const homeProfile = GOAL_PROFILES[home.strength];
          const awayProfile = GOAL_PROFILES[away.strength];
          const idx = (round + i + j) % 6;
          const homeGoals = homeProfile.scoredHome[idx];
          const awayGoals = Math.max(0, awayProfile.concededHome[idx] - 1);

          const kickoffAt = `now() - interval '${dayOffset} days'`;
          dayOffset -= 2;

          const { rows: matchRows } = await client.query(
            `INSERT INTO matches (
               provider_fixture_id, league_id, season_id, home_team_id, away_team_id,
               round, kickoff_at, status, status_detail, home_goals, away_goals
             )
             VALUES ($1,$2,$3,$4,$5,$6, ${kickoffAt}, 'finished', 'FT', $7, $8)
             ON CONFLICT (provider_fixture_id) DO UPDATE SET home_goals = EXCLUDED.home_goals
             RETURNING id`,
            [fixtureCounter, leagueId, seasonId, home.id, away.id, `Jornada ${round + 1}`, homeGoals, awayGoals]
          );
          const matchId = matchRows[0].id;
          fixtureCounter += 1;

          const homeXg = Math.max(0.3, homeGoals + (Math.random() - 0.5));
          const awayXg = Math.max(0.2, awayGoals + (Math.random() - 0.5));

          await client.query(
            `INSERT INTO match_team_stats (match_id, team_id, is_home, xg, possession_pct, dangerous_attacks, shots_total, shots_on_target, corners, fouls, yellow_cards, red_cards)
             VALUES ($1,$2,true,$3,$4,$5,$6,$7,$8,$9,$10,0)
             ON CONFLICT (match_id, team_id) DO NOTHING`,
            [matchId, home.id, homeXg.toFixed(2), 55 + Math.random() * 10, Math.round(40 + Math.random() * 20), 12 + Math.round(Math.random() * 6), 5 + Math.round(Math.random() * 4), 5, 10, 1]
          );
          await client.query(
            `INSERT INTO match_team_stats (match_id, team_id, is_home, xg, possession_pct, dangerous_attacks, shots_total, shots_on_target, corners, fouls, yellow_cards, red_cards)
             VALUES ($1,$2,false,$3,$4,$5,$6,$7,$8,$9,$10,0)
             ON CONFLICT (match_id, team_id) DO NOTHING`,
            [matchId, away.id, awayXg.toFixed(2), 45 - Math.random() * 10, Math.round(30 + Math.random() * 15), 8 + Math.round(Math.random() * 5), 3 + Math.round(Math.random() * 3), 3, 12, 1]
          );
        }
      }
    }

    logger.info('Seeding upcoming fixtures with market odds...');
    const { rows: bookmakerRows } = await client.query(
      `INSERT INTO bookmakers (provider_bookmaker_id, name) VALUES (1, 'DemoBook')
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`
    );
    const bookmakerId = bookmakerRows[0].id;

    const markets = {};
    for (const name of ['Match Winner', 'Double Chance', 'Goals Over/Under', 'Both Teams Score']) {
      const { rows } = await client.query(
        `INSERT INTO odds_markets (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [name]
      );
      markets[name] = rows[0].id;
    }

    const upcomingPairs = [
      ['ATN', 'SUR', 6],
      ['DCE', 'CFC', 30],
      ['ATN', 'CFC', 50],
    ];

    for (const [homeCode, awayCode, hoursFromNow] of upcomingPairs) {
      const home = teamIds[homeCode];
      const away = teamIds[awayCode];

      const { rows: matchRows } = await client.query(
        `INSERT INTO matches (
           provider_fixture_id, league_id, season_id, home_team_id, away_team_id,
           round, kickoff_at, status, status_detail
         )
         VALUES ($1,$2,$3,$4,$5,'Jornada Próxima', now() + ($6 || ' hours')::interval, 'scheduled', 'NS')
         ON CONFLICT (provider_fixture_id) DO UPDATE SET kickoff_at = EXCLUDED.kickoff_at
         RETURNING id`,
        [fixtureCounter, leagueId, seasonId, home.id, away.id, hoursFromNow]
      );
      const matchId = matchRows[0].id;
      fixtureCounter += 1;

      // Cuotas "generosas" en el favorito para garantizar al menos una value bet demostrable.
      const favoredHome = home.strength === 'strong' || (home.strength === 'average' && away.strength === 'weak');

      const oddsRows = [
        [markets['Match Winner'], 'Home', null, favoredHome ? 1.85 : 2.9],
        [markets['Match Winner'], 'Draw', null, 3.4],
        [markets['Match Winner'], 'Away', null, favoredHome ? 4.2 : 2.3],
        [markets['Double Chance'], 'Home/Draw', null, 1.25],
        [markets['Double Chance'], 'Away/Draw', null, 1.6],
        [markets['Goals Over/Under'], 'Over 1.5', 1.5, 1.3],
        [markets['Goals Over/Under'], 'Under 1.5', 1.5, 3.3],
        [markets['Goals Over/Under'], 'Over 2.5', 2.5, 1.95],
        [markets['Goals Over/Under'], 'Under 2.5', 2.5, 1.85],
        [markets['Both Teams Score'], 'Yes', null, 1.75],
        [markets['Both Teams Score'], 'No', null, 2.0],
      ];

      for (const [marketId, selection, handicap, oddsDecimal] of oddsRows) {
        await client.query(
          `INSERT INTO odds_snapshots (match_id, bookmaker_id, market_id, selection, handicap, odds_decimal)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [matchId, bookmakerId, marketId, selection, handicap, oddsDecimal]
        );
      }
    }

    logger.info('Seeding settled recommendation history for performance stats...');
    let bankroll = 1000;
    const outcomes = [
      { stake: 50, won: true, odds: 1.9 },
      { stake: 40, won: true, odds: 1.75 },
      { stake: 45, won: false, odds: 2.1 },
      { stake: 55, won: true, odds: 1.6 },
      { stake: 50, won: true, odds: 1.85 },
      { stake: 60, won: false, odds: 2.4 },
      { stake: 50, won: true, odds: 1.7 },
      { stake: 45, won: true, odds: 1.55 },
    ];

    let daysAgo = outcomes.length * 3;
    for (const outcome of outcomes) {
      const profitLoss = outcome.won ? outcome.stake * (outcome.odds - 1) : -outcome.stake;
      const bankrollBefore = bankroll;
      bankroll += profitLoss;

      await client.query(
        `INSERT INTO recommendation_records (
           kind, match_ids, legs, combined_odds, model_probability, kelly_stake_fraction,
           stake_amount, status, profit_loss, bankroll_before, bankroll_after,
           recommended_at, settled_at
         )
         VALUES (
           'low_risk_package', ARRAY[]::int[], '[]'::jsonb, $1, $2, $3, $4, $5, $6, $7, $8,
           now() - ($9 || ' days')::interval, now() - ($9 || ' days')::interval + interval '2 hours'
         )`,
        [
          outcome.odds, 1 / outcome.odds + 0.1, 0.05, outcome.stake,
          outcome.won ? 'won' : 'lost', profitLoss.toFixed(2), bankrollBefore.toFixed(2), bankroll.toFixed(2), daysAgo,
        ]
      );
      daysAgo -= 3;
    }

    logger.info(`Demo bankroll ended at $${bankroll.toFixed(2)} after ${outcomes.length} settled recommendations.`);
  });
}

seed()
  .then(() => {
    logger.info('Demo data seeded successfully.');
  })
  .catch((err) => {
    logger.error('Seeding failed', { error: err.message, stack: err.stack });
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
