const apiFootball = require('../services/apiFootballClient');
const weatherClient = require('../services/weatherClient');
const catalogRepo = require('../repositories/catalogRepository');
const matchRepo = require('../repositories/matchRepository');
const { query } = require('../db/pool');
const { runJob } = require('./runJob');
const config = require('../config');
const logger = require('../utils/logger');

async function getLeagueAndSeasonIds(providerLeagueId, seasonYear) {
  const { rows } = await query(
    `SELECT l.id AS league_id, s.id AS season_id
     FROM leagues l JOIN seasons s ON s.league_id = l.id
     WHERE l.provider_league_id = $1 AND s.year = $2`,
    [providerLeagueId, seasonYear]
  );
  return rows[0] ?? null;
}

/**
 * Sincroniza fixtures (pasados y futuros) de una liga/temporada, incluyendo
 * estadísticas avanzadas para partidos ya finalizados y clima para los próximos.
 * Requiere que syncCatalog ya haya corrido para esa liga.
 */
async function syncFixturesForLeagueSeason(providerLeagueId, seasonYear) {
  return runJob(
    'sync_fixtures',
    async (ctx) => {
      const ids = await getLeagueAndSeasonIds(providerLeagueId, seasonYear);
      if (!ids) {
        throw new Error(`League/season not found locally for provider_league_id=${providerLeagueId}, year=${seasonYear}. Run syncCatalog first.`);
      }

      const fixtures = await apiFootball.endpoints.fixturesByLeagueSeason(providerLeagueId, seasonYear);

      for (const fx of fixtures) {
        try {
          await processFixture(fx, ids.league_id, ids.season_id);
          ctx.trackProcessed(1);
        } catch (err) {
          await ctx.reportError('fixture', fx.fixture?.id, err, fx.fixture);
        }
      }
    },
    { providerLeagueId, seasonYear }
  );
}

async function processFixture(fx, leagueId, seasonId) {
  const homeTeamId = await catalogRepo.getTeamIdByProviderId(fx.teams.home.id);
  const awayTeamId = await catalogRepo.getTeamIdByProviderId(fx.teams.away.id);

  if (!homeTeamId || !awayTeamId) {
    throw new Error(`Unknown team(s) for fixture ${fx.fixture.id}: home=${fx.teams.home.id}, away=${fx.teams.away.id}`);
  }

  let venueId = null;
  if (fx.fixture.venue?.id) {
    venueId = await catalogRepo.upsertVenue({
      providerVenueId: fx.fixture.venue.id,
      name: fx.fixture.venue.name,
      city: fx.fixture.venue.city,
      countryId: null,
      latitude: null,
      longitude: null,
      surface: null,
      capacity: null,
    });
  }

  let refereeId = null;
  if (fx.fixture.referee) {
    // API-Football expone el árbitro como texto libre en /fixtures; el id numérico
    // llega en otros endpoints. Usamos el nombre como clave estable vía upsert por nombre.
    refereeId = await catalogRepo.upsertReferee({
      providerRefereeId: hashRefereeName(fx.fixture.referee),
      name: fx.fixture.referee,
      nationality: null,
    });
  }

  const matchId = await matchRepo.upsertMatch({
    providerFixtureId: fx.fixture.id,
    leagueId,
    seasonId,
    venueId,
    refereeId,
    homeTeamId,
    awayTeamId,
    round: fx.league?.round,
    kickoffAt: fx.fixture.date,
    status: mapStatus(fx.fixture.status.short),
    statusDetail: fx.fixture.status.short,
    homeGoals: fx.goals.home,
    awayGoals: fx.goals.away,
    homeGoalsHt: fx.score?.halftime?.home ?? null,
    awayGoalsHt: fx.score?.halftime?.away ?? null,
  });

  const isFinished = fx.fixture.status.short === 'FT';
  const isUpcoming = new Date(fx.fixture.date) > new Date();

  // Este job corre cada hora contra la temporada completa: sin este chequeo,
  // volvería a pedir estadísticas de TODOS los partidos ya finalizados en cada
  // corrida, para siempre (cientos de requests/hora en vez de solo los nuevos).
  if (isFinished && !(await matchRepo.hasMatchTeamStats(matchId))) {
    await syncMatchStatistics(matchId, fx.fixture.id, homeTeamId, awayTeamId);
  } else if (isUpcoming) {
    await attachWeatherForecast(matchId, fx);
  }
}

async function syncMatchStatistics(matchId, providerFixtureId, homeTeamId, awayTeamId) {
  try {
    const stats = await apiFootball.endpoints.fixtureStatistics(providerFixtureId);
    for (const teamStats of stats) {
      const teamId = await catalogRepo.getTeamIdByProviderId(teamStats.team.id);
      if (!teamId) continue;

      const parsed = parseStatisticsBlock(teamStats.statistics);
      await matchRepo.upsertMatchTeamStats(matchId, teamId, teamId === homeTeamId, parsed);
    }
  } catch (err) {
    logger.warn(`Could not sync statistics for fixture ${providerFixtureId}`, { error: err.message });
  }
}

function parseStatisticsBlock(statsArray) {
  const find = (type) => statsArray.find((s) => s.type === type)?.value;
  const toNumber = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string' && v.includes('%')) return parseFloat(v.replace('%', ''));
    return Number(v);
  };

  return {
    // La API expone este campo como "expected_goals" (snake_case), no "Expected
    // Goals" — verificado contra una respuesta real de /fixtures/statistics.
    xg: toNumber(find('expected_goals')),
    xga: null, // se calcula en un paso posterior de agregación (xG concedido = xG del rival)
    possessionPct: toNumber(find('Ball Possession')),
    dangerousAttacks: toNumber(find('Dangerous Attacks')),
    shotsTotal: toNumber(find('Total Shots')),
    shotsOnTarget: toNumber(find('Shots on Goal')),
    corners: toNumber(find('Corner Kicks')),
    fouls: toNumber(find('Fouls')),
    yellowCards: toNumber(find('Yellow Cards')),
    redCards: toNumber(find('Red Cards')),
    passesTotal: toNumber(find('Total passes')),
    passesAccuratePct: toNumber(find('Passes %')),
    bigChancesCreated: null,
  };
}

async function attachWeatherForecast(matchId, fx) {
  if (!fx.fixture.venue?.id) return;

  const { rows } = await query('SELECT latitude, longitude FROM venues WHERE provider_venue_id = $1', [
    fx.fixture.venue.id,
  ]);
  const venue = rows[0];
  if (!venue?.latitude || !venue?.longitude) return;

  const forecast = await weatherClient.getForecast({
    latitude: venue.latitude,
    longitude: venue.longitude,
    kickoffAt: fx.fixture.date,
  });

  await matchRepo.upsertMatchWeather(matchId, forecast, true, 'openweathermap');
}

function mapStatus(shortStatus) {
  const liveStatuses = ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'];
  const finishedStatuses = ['FT', 'AET', 'PEN'];
  const postponedStatuses = ['PST'];
  const cancelledStatuses = ['CANC', 'ABD', 'AWD', 'WO'];

  if (finishedStatuses.includes(shortStatus)) return 'finished';
  if (liveStatuses.includes(shortStatus)) return 'live';
  if (postponedStatuses.includes(shortStatus)) return 'postponed';
  if (cancelledStatuses.includes(shortStatus)) return 'cancelled';
  return 'scheduled';
}

function hashRefereeName(name) {
  // Id sintético estable a partir del nombre para poder usar provider_referee_id
  // (evita colisiones de UNIQUE en referees cuando la API no da un id numérico).
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

module.exports = { syncFixturesForLeagueSeason };
