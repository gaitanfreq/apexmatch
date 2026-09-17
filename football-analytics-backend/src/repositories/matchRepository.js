const { query } = require('../db/pool');

async function upsertMatch({
  providerFixtureId,
  leagueId,
  seasonId,
  venueId,
  refereeId,
  homeTeamId,
  awayTeamId,
  round,
  kickoffAt,
  status,
  statusDetail,
  homeGoals,
  awayGoals,
  homeGoalsHt,
  awayGoalsHt,
}) {
  const { rows } = await query(
    `INSERT INTO matches (
       provider_fixture_id, league_id, season_id, venue_id, referee_id,
       home_team_id, away_team_id, round, kickoff_at, status, status_detail,
       home_goals, away_goals, home_goals_ht, away_goals_ht, last_synced_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now())
     ON CONFLICT (provider_fixture_id) DO UPDATE SET
       venue_id = EXCLUDED.venue_id,
       referee_id = EXCLUDED.referee_id,
       round = EXCLUDED.round,
       kickoff_at = EXCLUDED.kickoff_at,
       status = EXCLUDED.status,
       status_detail = EXCLUDED.status_detail,
       home_goals = EXCLUDED.home_goals,
       away_goals = EXCLUDED.away_goals,
       home_goals_ht = EXCLUDED.home_goals_ht,
       away_goals_ht = EXCLUDED.away_goals_ht,
       last_synced_at = now(),
       updated_at = now()
     RETURNING id`,
    [
      providerFixtureId, leagueId, seasonId, venueId, refereeId,
      homeTeamId, awayTeamId, round, kickoffAt, status, statusDetail,
      homeGoals, awayGoals, homeGoalsHt, awayGoalsHt,
    ]
  );
  return rows[0].id;
}

async function getMatchIdByProviderId(providerFixtureId) {
  const { rows } = await query('SELECT id FROM matches WHERE provider_fixture_id = $1', [providerFixtureId]);
  return rows[0]?.id ?? null;
}

/** true si ya se sincronizaron estadísticas avanzadas para este partido (evita re-pedirlas a la API). */
async function hasMatchTeamStats(matchId) {
  const { rows } = await query('SELECT 1 FROM match_team_stats WHERE match_id = $1 LIMIT 1', [matchId]);
  return rows.length > 0;
}

async function upsertMatchTeamStats(matchId, teamId, isHome, stats) {
  await query(
    `INSERT INTO match_team_stats (
       match_id, team_id, is_home, xg, xga, possession_pct, dangerous_attacks,
       shots_total, shots_on_target, corners, fouls, yellow_cards, red_cards,
       passes_total, passes_accurate_pct, big_chances_created
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (match_id, team_id) DO UPDATE SET
       xg = EXCLUDED.xg, xga = EXCLUDED.xga, possession_pct = EXCLUDED.possession_pct,
       dangerous_attacks = EXCLUDED.dangerous_attacks, shots_total = EXCLUDED.shots_total,
       shots_on_target = EXCLUDED.shots_on_target, corners = EXCLUDED.corners,
       fouls = EXCLUDED.fouls, yellow_cards = EXCLUDED.yellow_cards, red_cards = EXCLUDED.red_cards,
       passes_total = EXCLUDED.passes_total, passes_accurate_pct = EXCLUDED.passes_accurate_pct,
       big_chances_created = EXCLUDED.big_chances_created`,
    [
      matchId, teamId, isHome, stats.xg, stats.xga, stats.possessionPct, stats.dangerousAttacks,
      stats.shotsTotal, stats.shotsOnTarget, stats.corners, stats.fouls, stats.yellowCards,
      stats.redCards, stats.passesTotal, stats.passesAccuratePct, stats.bigChancesCreated,
    ]
  );
}

async function upsertMatchWeather(matchId, weather, isForecast, source) {
  if (!weather) return;
  await query(
    `INSERT INTO match_weather (
       match_id, temperature_celsius, feels_like_celsius, humidity_pct,
       wind_speed_kph, precipitation_mm, condition, is_forecast, source, fetched_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
     ON CONFLICT (match_id) DO UPDATE SET
       temperature_celsius = EXCLUDED.temperature_celsius,
       feels_like_celsius = EXCLUDED.feels_like_celsius,
       humidity_pct = EXCLUDED.humidity_pct,
       wind_speed_kph = EXCLUDED.wind_speed_kph,
       precipitation_mm = EXCLUDED.precipitation_mm,
       condition = EXCLUDED.condition,
       is_forecast = EXCLUDED.is_forecast,
       source = EXCLUDED.source,
       fetched_at = now()`,
    [
      matchId, weather.temperatureCelsius, weather.feelsLikeCelsius, weather.humidityPct,
      weather.windSpeedKph, weather.precipitationMm, weather.condition, isForecast, source,
    ]
  );
}

async function markLineupsConfirmed(matchId) {
  await query('UPDATE matches SET lineups_confirmed_at = now() WHERE id = $1', [matchId]);
}

module.exports = {
  upsertMatch,
  getMatchIdByProviderId,
  hasMatchTeamStats,
  upsertMatchTeamStats,
  upsertMatchWeather,
  markLineupsConfirmed,
};
