const apiFootball = require('../services/apiFootballClient');
const catalogRepo = require('../repositories/catalogRepository');
const { runJob } = require('./runJob');
const config = require('../config');

/**
 * Sincroniza ligas seguidas (TRACKED_LEAGUE_IDS), sus equipos y venues para
 * la temporada actual. Es la base que necesitan fixtures/odds/injuries.
 */
async function syncCatalog(leagueIds = config.trackedLeagueIds, season = config.currentSeasonYear) {
  return runJob('sync_catalog', async (ctx) => {
    const allLeagues = await apiFootball.endpoints.leagues();
    const relevant = allLeagues.filter((entry) => leagueIds.includes(entry.league.id));

    for (const entry of relevant) {
      try {
        const countryId = await catalogRepo.upsertCountry(
          entry.country?.name,
          entry.country?.code,
          entry.country?.flag
        );

        const leagueId = await catalogRepo.upsertLeague({
          providerLeagueId: entry.league.id,
          name: entry.league.name,
          type: entry.league.type?.toLowerCase() === 'cup' ? 'cup' : 'league',
          countryId,
          logoUrl: entry.league.logo,
        });

        const seasonInfo = entry.seasons?.find((s) => s.year === season) ?? entry.seasons?.slice(-1)[0];
        const seasonId = await catalogRepo.upsertSeason({
          leagueId,
          year: seasonInfo?.year ?? season,
          startDate: seasonInfo?.start,
          endDate: seasonInfo?.end,
          isCurrent: Boolean(seasonInfo?.current),
        });

        await syncTeamsForLeague(entry.league.id, season, ctx);
        ctx.trackProcessed(1);
        void seasonId;
      } catch (err) {
        await ctx.reportError('league', entry.league.id, err, entry);
      }
    }
  });
}

async function syncTeamsForLeague(providerLeagueId, season, ctx) {
  const teams = await apiFootball.endpoints.teamsByLeague(providerLeagueId, season);

  for (const item of teams) {
    try {
      let venueId = null;
      if (item.venue?.id) {
        const countryId = await catalogRepo.upsertCountry(item.team.country, null, null);
        venueId = await catalogRepo.upsertVenue({
          providerVenueId: item.venue.id,
          name: item.venue.name,
          city: item.venue.city,
          countryId,
          latitude: item.venue.latitude ?? null,
          longitude: item.venue.longitude ?? null,
          surface: item.venue.surface,
          capacity: item.venue.capacity,
        });
      }

      const countryId = await catalogRepo.upsertCountry(item.team.country, null, null);
      await catalogRepo.upsertTeam({
        providerTeamId: item.team.id,
        name: item.team.name,
        shortCode: item.team.code,
        countryId,
        foundedYear: item.team.founded,
        isNationalTeam: Boolean(item.team.national),
        logoUrl: item.team.logo,
        venueId,
      });
      ctx.trackProcessed(1);
    } catch (err) {
      await ctx.reportError('team', item.team?.id, err, item);
    }
  }
}

module.exports = { syncCatalog, syncTeamsForLeague };
