const { query } = require('../db/pool');

/**
 * NOTA: el driver `pg` devuelve columnas NUMERIC/DECIMAL como strings (para no
 * perder precisión en valores arbitrariamente grandes), no como JS number.
 * Los módulos de `src/analytics/` asumen números limpios (así están
 * diseñados y testeados), así que toda columna NUMERIC se castea a
 * `double precision` en el SQL para que llegue como number real — evita bugs
 * silenciosos de concatenación de strings en sumas (ej. `0 + '2.97'`).
 */

/** Últimos N partidos de un equipo jugando de LOCAL, con sus stats avanzadas. */
async function getRecentHomeMatches(teamId, { limit = 10 } = {}) {
  const { rows } = await query(
    `SELECT m.home_goals AS "goalsFor", m.away_goals AS "goalsAgainst",
            hs.xg::double precision AS "xgFor", aws.xg::double precision AS "xgAgainst"
     FROM matches m
     LEFT JOIN match_team_stats hs ON hs.match_id = m.id AND hs.team_id = m.home_team_id
     LEFT JOIN match_team_stats aws ON aws.match_id = m.id AND aws.team_id = m.away_team_id
     WHERE m.home_team_id = $1 AND m.status = 'finished'
     ORDER BY m.kickoff_at DESC
     LIMIT $2`,
    [teamId, limit]
  );
  return rows;
}

/** Últimos N partidos de un equipo jugando de VISITANTE, con sus stats avanzadas. */
async function getRecentAwayMatches(teamId, { limit = 10 } = {}) {
  const { rows } = await query(
    `SELECT m.away_goals AS "goalsFor", m.home_goals AS "goalsAgainst",
            aws.xg::double precision AS "xgFor", hs.xg::double precision AS "xgAgainst"
     FROM matches m
     LEFT JOIN match_team_stats hs ON hs.match_id = m.id AND hs.team_id = m.home_team_id
     LEFT JOIN match_team_stats aws ON aws.match_id = m.id AND aws.team_id = m.away_team_id
     WHERE m.away_team_id = $1 AND m.status = 'finished'
     ORDER BY m.kickoff_at DESC
     LIMIT $2`,
    [teamId, limit]
  );
  return rows;
}

/** Promedio de goles anotados por locales/visitantes en una liga/temporada (para normalizar fuerzas). */
async function getLeagueAverages(leagueId, seasonId) {
  const { rows } = await query(
    `SELECT AVG(home_goals) AS "avgHomeGoals", AVG(away_goals) AS "avgAwayGoals"
     FROM matches
     WHERE league_id = $1 AND season_id = $2 AND status = 'finished'`,
    [leagueId, seasonId]
  );
  const row = rows[0];
  return {
    avgHomeGoals: row?.avgHomeGoals != null ? Number(row.avgHomeGoals) : null,
    avgAwayGoals: row?.avgAwayGoals != null ? Number(row.avgAwayGoals) : null,
  };
}

/** Últimas cuotas conocidas (odds_latest) para un partido, en los mercados soportados por el modelo. */
async function getLatestOddsForMatch(matchId) {
  const { rows } = await query(
    `SELECT ol.selection, ol.handicap::double precision AS handicap,
            ol.odds_decimal::double precision AS "oddsDecimal",
            om.name AS market, b.name AS bookmaker
     FROM odds_latest ol
     JOIN odds_markets om ON om.id = ol.market_id
     JOIN bookmakers b ON b.id = ol.bookmaker_id
     WHERE ol.match_id = $1
       AND (
         om.name ILIKE '%match winner%' OR om.name = '1X2' OR
         om.name ILIKE '%double chance%' OR
         om.name ILIKE '%over/under%' OR om.name ILIKE '%goals over%' OR
         om.name ILIKE '%both teams score%'
       )`,
    [matchId]
  );
  return rows.map((r) => ({ ...r, matchId }));
}

/** Fixtures próximos dentro de una ventana de horas, para alimentar el generador de parlays. */
async function getUpcomingFixtures({ withinHours = 72, leagueIds = [] } = {}) {
  const { rows } = await query(
    `SELECT m.id, m.provider_fixture_id AS "providerFixtureId", m.league_id AS "leagueId",
            m.season_id AS "seasonId", m.home_team_id AS "homeTeamId", m.away_team_id AS "awayTeamId",
            ht.name AS "homeTeamName", at.name AS "awayTeamName",
            m.kickoff_at AS "kickoffAt"
     FROM matches m
     JOIN teams ht ON ht.id = m.home_team_id
     JOIN teams at ON at.id = m.away_team_id
     WHERE m.status = 'scheduled'
       AND m.kickoff_at BETWEEN now() AND now() + ($1 || ' hours')::interval
       AND ($2::int[] IS NULL OR m.league_id = ANY($2::int[]))
     ORDER BY m.kickoff_at ASC`,
    [withinHours, leagueIds.length ? leagueIds : null]
  );
  return rows;
}

/**
 * Ligas trackeadas que tienen al menos un partido en la base de datos, con
 * el conteo de partidos por estado — alimenta el filtro de ligas de
 * Live Predictions (GET /api/leagues).
 */
async function getTrackedLeagues() {
  const { rows } = await query(
    `SELECT l.id, l.provider_league_id AS "providerLeagueId", l.name, l.logo_url AS "logoUrl",
            c.name AS "countryName",
            COUNT(*) FILTER (WHERE m.status = 'scheduled')::int AS "scheduledCount",
            COUNT(*) FILTER (WHERE m.status = 'live')::int AS "liveCount",
            COUNT(*) FILTER (WHERE m.status = 'finished')::int AS "finishedCount"
     FROM leagues l
     JOIN matches m ON m.league_id = l.id
     LEFT JOIN countries c ON c.id = l.country_id
     GROUP BY l.id, c.name
     ORDER BY l.name ASC`
  );
  return rows;
}

/**
 * Partidos dentro de una ventana simétrica alrededor de ahora (pasado y
 * futuro), filtrables por liga y por estado (scheduled/live/finished).
 * A diferencia de `getUpcomingFixtures` (solo futuros programados, usada por
 * el generador de paquetes/value bets), esta alimenta la vista general de
 * Live Predictions que también muestra partidos en juego y ya finalizados.
 */
async function getFixtures({ withinHours = 48, leagueIds = [], statuses = ['scheduled', 'live'] } = {}) {
  const { rows } = await query(
    `SELECT m.id, m.provider_fixture_id AS "providerFixtureId", m.league_id AS "leagueId",
            l.name AS "leagueName", m.season_id AS "seasonId",
            m.home_team_id AS "homeTeamId", m.away_team_id AS "awayTeamId",
            ht.name AS "homeTeamName", at.name AS "awayTeamName",
            m.kickoff_at AS "kickoffAt", m.status, m.status_detail AS "statusDetail",
            m.home_goals AS "homeGoals", m.away_goals AS "awayGoals"
     FROM matches m
     JOIN teams ht ON ht.id = m.home_team_id
     JOIN teams at ON at.id = m.away_team_id
     JOIN leagues l ON l.id = m.league_id
     WHERE m.status = ANY($1::text[])
       AND m.kickoff_at BETWEEN now() - ($2 || ' hours')::interval AND now() + ($2 || ' hours')::interval
       AND ($3::int[] IS NULL OR m.league_id = ANY($3::int[]))
     ORDER BY m.kickoff_at ASC`,
    [statuses, withinHours, leagueIds.length ? leagueIds : null]
  );
  return rows;
}

module.exports = {
  getRecentHomeMatches,
  getRecentAwayMatches,
  getLeagueAverages,
  getLatestOddsForMatch,
  getUpcomingFixtures,
  getTrackedLeagues,
  getFixtures,
};
