const { query } = require('../db/pool');

async function upsertPlayer({
  providerPlayerId, name, firstName, lastName, dateOfBirth,
  nationality, heightCm, weightKg, primaryPosition, currentTeamId, photoUrl,
}) {
  const { rows } = await query(
    `INSERT INTO players (
       provider_player_id, name, first_name, last_name, date_of_birth,
       nationality, height_cm, weight_kg, primary_position, current_team_id, photo_url
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (provider_player_id) DO UPDATE SET
       name = EXCLUDED.name, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
       date_of_birth = EXCLUDED.date_of_birth, nationality = EXCLUDED.nationality,
       height_cm = EXCLUDED.height_cm, weight_kg = EXCLUDED.weight_kg,
       primary_position = EXCLUDED.primary_position, current_team_id = EXCLUDED.current_team_id,
       photo_url = EXCLUDED.photo_url, updated_at = now()
     RETURNING id`,
    [providerPlayerId, name, firstName, lastName, dateOfBirth, nationality, heightCm, weightKg, primaryPosition, currentTeamId, photoUrl]
  );
  return rows[0].id;
}

async function insertInjury({ playerId, teamId, injuryType, status, reportedAt, expectedReturnDate, source }) {
  await query(
    `INSERT INTO player_injuries (player_id, team_id, injury_type, status, reported_at, expected_return_date, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [playerId, teamId, injuryType, status, reportedAt, expectedReturnDate, source]
  );
}

async function upsertMatchAvailability({ matchId, playerId, teamId, availability, reason }) {
  await query(
    `INSERT INTO player_match_availability (match_id, player_id, team_id, availability, reason)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (match_id, player_id) DO UPDATE SET
       availability = EXCLUDED.availability, reason = EXCLUDED.reason, updated_at = now()`,
    [matchId, playerId, teamId, availability, reason]
  );
}

module.exports = { upsertPlayer, insertInjury, upsertMatchAvailability };
