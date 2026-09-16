const { query } = require('../db/pool');

/** Upserts idempotentes para entidades de catálogo (países, ligas, temporadas, equipos, venues). */

async function upsertCountry(name, code, flagUrl) {
  if (!name) return null;
  const { rows } = await query(
    `INSERT INTO countries (name, code, flag_url)
     VALUES ($1, $2, $3)
     ON CONFLICT (name) DO UPDATE SET code = EXCLUDED.code, flag_url = EXCLUDED.flag_url
     RETURNING id`,
    [name, code, flagUrl]
  );
  return rows[0].id;
}

async function upsertLeague({ providerLeagueId, name, type, countryId, logoUrl }) {
  const { rows } = await query(
    `INSERT INTO leagues (provider_league_id, name, type, country_id, logo_url)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (provider_league_id) DO UPDATE
       SET name = EXCLUDED.name, type = EXCLUDED.type, country_id = EXCLUDED.country_id,
           logo_url = EXCLUDED.logo_url, updated_at = now()
     RETURNING id`,
    [providerLeagueId, name, type, countryId, logoUrl]
  );
  return rows[0].id;
}

async function upsertSeason({ leagueId, year, startDate, endDate, isCurrent }) {
  const { rows } = await query(
    `INSERT INTO seasons (league_id, year, start_date, end_date, is_current)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (league_id, year) DO UPDATE
       SET start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
           is_current = EXCLUDED.is_current
     RETURNING id`,
    [leagueId, year, startDate, endDate, isCurrent]
  );
  return rows[0].id;
}

async function upsertVenue({ providerVenueId, name, city, countryId, latitude, longitude, surface, capacity }) {
  if (!providerVenueId) return null;
  const { rows } = await query(
    `INSERT INTO venues (provider_venue_id, name, city, country_id, latitude, longitude, surface, capacity)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (provider_venue_id) DO UPDATE
       SET name = EXCLUDED.name, city = EXCLUDED.city, country_id = EXCLUDED.country_id,
           latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
           surface = EXCLUDED.surface, capacity = EXCLUDED.capacity
     RETURNING id`,
    [providerVenueId, name, city, countryId, latitude, longitude, surface, capacity]
  );
  return rows[0].id;
}

async function upsertTeam({ providerTeamId, name, shortCode, countryId, foundedYear, isNationalTeam, logoUrl, venueId }) {
  const { rows } = await query(
    `INSERT INTO teams (provider_team_id, name, short_code, country_id, founded_year, is_national_team, logo_url, venue_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (provider_team_id) DO UPDATE
       SET name = EXCLUDED.name, short_code = EXCLUDED.short_code, country_id = EXCLUDED.country_id,
           founded_year = EXCLUDED.founded_year, is_national_team = EXCLUDED.is_national_team,
           logo_url = EXCLUDED.logo_url, venue_id = EXCLUDED.venue_id, updated_at = now()
     RETURNING id`,
    [providerTeamId, name, shortCode, countryId, foundedYear, isNationalTeam, logoUrl, venueId]
  );
  return rows[0].id;
}

async function upsertReferee({ providerRefereeId, name, nationality }) {
  if (!providerRefereeId || !name) return null;
  const { rows } = await query(
    `INSERT INTO referees (provider_referee_id, name, nationality)
     VALUES ($1, $2, $3)
     ON CONFLICT (provider_referee_id) DO UPDATE
       SET name = EXCLUDED.name, nationality = EXCLUDED.nationality, updated_at = now()
     RETURNING id`,
    [providerRefereeId, name, nationality]
  );
  return rows[0].id;
}

async function getTeamIdByProviderId(providerTeamId) {
  const { rows } = await query('SELECT id FROM teams WHERE provider_team_id = $1', [providerTeamId]);
  return rows[0]?.id ?? null;
}

module.exports = {
  upsertCountry,
  upsertLeague,
  upsertSeason,
  upsertVenue,
  upsertTeam,
  upsertReferee,
  getTeamIdByProviderId,
};
