const apiFootball = require('../services/apiFootballClient');
const catalogRepo = require('../repositories/catalogRepository');
const playerRepo = require('../repositories/playerRepository');
const matchRepo = require('../repositories/matchRepository');
const { query } = require('../db/pool');
const { runJob } = require('./runJob');

/**
 * Sincroniza alineaciones confirmadas para partidos que arrancan pronto.
 * API-Football suele confirmar lineups ~1h antes del kickoff.
 */
async function syncLineupsForImminentMatches({ withinMinutes = 90 } = {}) {
  return runJob('sync_lineups', async (ctx) => {
    const { rows: imminentMatches } = await query(
      `SELECT id, provider_fixture_id FROM matches
       WHERE status = 'scheduled'
         AND lineups_confirmed_at IS NULL
         AND kickoff_at BETWEEN now() AND now() + ($1 || ' minutes')::interval`,
      [withinMinutes]
    );

    for (const match of imminentMatches) {
      try {
        const confirmed = await syncLineupForFixture(match.id, match.provider_fixture_id);
        if (confirmed) await matchRepo.markLineupsConfirmed(match.id);
        ctx.trackProcessed(1);
      } catch (err) {
        await ctx.reportError('lineup', match.provider_fixture_id, err);
      }
    }
  });
}

async function syncLineupForFixture(matchId, providerFixtureId) {
  const lineups = await apiFootball.endpoints.fixtureLineups(providerFixtureId);
  if (!lineups.length) return false;

  for (const teamLineup of lineups) {
    const teamId = await catalogRepo.getTeamIdByProviderId(teamLineup.team.id);
    if (!teamId) continue;

    const { rows } = await query(
      `INSERT INTO lineups (match_id, team_id, formation, is_confirmed, coach_name)
       VALUES ($1,$2,$3,true,$4)
       ON CONFLICT (match_id, team_id) DO UPDATE
         SET formation = EXCLUDED.formation, is_confirmed = true, coach_name = EXCLUDED.coach_name, fetched_at = now()
       RETURNING id`,
      [matchId, teamId, teamLineup.formation, teamLineup.coach?.name]
    );
    const lineupId = rows[0].id;

    const starters = (teamLineup.startXI || []).map((p) => ({ ...p.player, isStarter: true }));
    const subs = (teamLineup.substitutes || []).map((p) => ({ ...p.player, isStarter: false }));

    for (const p of [...starters, ...subs]) {
      const playerId = await playerRepo.upsertPlayer({
        providerPlayerId: p.id,
        name: p.name,
        firstName: null,
        lastName: null,
        dateOfBirth: null,
        nationality: null,
        heightCm: null,
        weightKg: null,
        primaryPosition: p.pos,
        currentTeamId: teamId,
        photoUrl: null,
      });

      await query(
        `INSERT INTO lineup_players (lineup_id, player_id, position, shirt_number, is_starter, grid_position)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (lineup_id, player_id) DO UPDATE
           SET position = EXCLUDED.position, shirt_number = EXCLUDED.shirt_number,
               is_starter = EXCLUDED.is_starter, grid_position = EXCLUDED.grid_position`,
        [lineupId, playerId, p.pos, p.number, p.isStarter, p.grid]
      );

      await playerRepo.upsertMatchAvailability({
        matchId,
        playerId,
        teamId,
        availability: 'available',
        reason: null,
      });
    }
  }

  return true;
}

module.exports = { syncLineupsForImminentMatches, syncLineupForFixture };
