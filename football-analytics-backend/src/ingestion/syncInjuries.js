const apiFootball = require('../services/apiFootballClient');
const catalogRepo = require('../repositories/catalogRepository');
const playerRepo = require('../repositories/playerRepository');
const { runJob } = require('./runJob');
const config = require('../config');

/** Sincroniza lesiones reportadas por liga/temporada. */
async function syncInjuriesForLeagueSeason(providerLeagueId, seasonYear) {
  return runJob(
    'sync_injuries',
    async (ctx) => {
      const injuries = await apiFootball.endpoints.injuries(providerLeagueId, seasonYear);

      for (const item of injuries) {
        try {
          const teamId = await catalogRepo.getTeamIdByProviderId(item.team.id);

          const playerId = await playerRepo.upsertPlayer({
            providerPlayerId: item.player.id,
            name: item.player.name,
            firstName: null,
            lastName: null,
            dateOfBirth: null,
            nationality: null,
            heightCm: null,
            weightKg: null,
            primaryPosition: null,
            currentTeamId: teamId,
            photoUrl: item.player.photo,
          });

          await playerRepo.insertInjury({
            playerId,
            teamId,
            injuryType: item.player.reason,
            status: mapInjuryStatus(item.player.type),
            reportedAt: item.fixture?.date ?? null,
            expectedReturnDate: null,
            source: 'api-football',
          });

          ctx.trackProcessed(1);
        } catch (err) {
          await ctx.reportError('injury', item.player?.id, err, item);
        }
      }
    },
    { providerLeagueId, seasonYear }
  );
}

function mapInjuryStatus(type) {
  if (!type) return 'out';
  const normalized = type.toLowerCase();
  if (normalized.includes('doubt')) return 'doubtful';
  if (normalized.includes('question')) return 'questionable';
  return 'out';
}

module.exports = { syncInjuriesForLeagueSeason };
