/**
 * Servicio simulador de partidos: alimenta automáticamente la base de datos
 * con partidos de las ligas principales (Champions League, La Liga, Premier
 * League, Serie A) cuando no hay una API_FOOTBALL_KEY real
 * (MATCH_DATA_SOURCE=simulator, ver src/config/index.js) — alternativa
 * explícitamente prevista para poder demostrar el pipeline completo sin
 * depender de un proveedor externo de pago.
 *
 * Cada corrida (`simulateTick`, pensada para un cron cada 5-10 min):
 *   1. Garantiza el catálogo (ligas/temporadas/clubes reales) y que cada
 *      liga tenga al menos MIN_UPCOMING_PER_LEAGUE partidos programados en
 *      las próximas 48h, generando cuotas iniciales para los nuevos.
 *   2. Refresca las cuotas de los partidos ya programados (nuevo snapshot
 *      con una ineficiencia de mercado aleatoria — así aparecen/desaparecen
 *      value bets de una corrida a otra, igual que en un mercado real).
 *   3. Avanza el estado de los partidos: 'scheduled' -> 'live' al llegar el
 *      kickoff (el marcador final se decide en ese momento — no hay
 *      seguimiento minuto a minuto real, ver nota más abajo) y 'live' ->
 *      'finished' tras LIVE_DURATION_MINUTES, generando sus estadísticas
 *      avanzadas (match_team_stats) para que el estimador de xG siga
 *      teniendo historial reciente.
 */
const { query } = require('../db/pool');
const catalogRepo = require('../repositories/catalogRepository');
const matchRepo = require('../repositories/matchRepository');
const oddsRepo = require('../repositories/oddsRepository');
const { predictMatch } = require('../analytics/poissonModel');
const { runJob } = require('./runJob');
const config = require('../config');
const logger = require('../utils/logger');
const { LEAGUES, CLUB_RATINGS, LEAGUE_ROSTERS, computeMatchXG, samplePoisson } = require('./simulatorData');

const MIN_UPCOMING_PER_LEAGUE = 3;
const LIVE_DURATION_MINUTES = 105;
const BOOKMAKER_NAME = 'SimBook';
// provider_bookmaker_id tiene su propia constraint UNIQUE (independiente de `name`) —
// 2 evita chocar con el bookmaker "DemoBook" (id=1) de scripts/seed-demo-data.js.
const BOOKMAKER_PROVIDER_ID = 2;
const SIM_TEAM_ID_MIN = 700100;
const SIM_TEAM_ID_MAX = 700200;

/** Crea/actualiza las 4 ligas, sus temporadas y el roster de clubes. Idempotente (upserts). */
async function ensureCatalog() {
  const leagueIds = {};
  const seasonIds = {};

  for (const [key, league] of Object.entries(LEAGUES)) {
    const countryId = await catalogRepo.upsertCountry(league.countryName, null, null);
    const leagueId = await catalogRepo.upsertLeague({
      providerLeagueId: league.providerLeagueId,
      name: league.name,
      type: 'league',
      countryId,
      logoUrl: null,
    });
    leagueIds[key] = leagueId;
    seasonIds[key] = await catalogRepo.upsertSeason({
      leagueId,
      year: config.currentSeasonYear,
      startDate: null,
      endDate: null,
      isCurrent: true,
    });
  }

  const teamIds = {};
  for (const [name, rating] of Object.entries(CLUB_RATINGS)) {
    teamIds[name] = await catalogRepo.upsertTeam({
      providerTeamId: rating.providerTeamId,
      name,
      shortCode: null,
      countryId: null,
      foundedYear: null,
      isNationalTeam: false,
      logoUrl: null,
      venueId: null,
    });
  }

  return { leagueIds, seasonIds, teamIds };
}

/** Genera un snapshot de cuotas (4 mercados) a partir del xG del partido, con una ineficiencia de mercado aleatoria. */
async function generateOddsForFixture(matchId, homeXG, awayXG) {
  const { markets } = predictMatch({ homeXG, awayXG });
  const bookmakerId = await oddsRepo.upsertBookmaker(BOOKMAKER_PROVIDER_ID, BOOKMAKER_NAME);

  const marketDefs = [
    {
      name: 'Match Winner',
      entries: [
        ['Home', markets.homeWin, null],
        ['Draw', markets.draw, null],
        ['Away', markets.awayWin, null],
      ],
    },
    {
      name: 'Double Chance',
      entries: [
        ['Home/Draw', markets.doubleChance.homeOrDraw, null],
        ['Draw/Away', markets.doubleChance.awayOrDraw, null],
        ['Home/Away', markets.doubleChance.homeOrAway, null],
      ],
    },
    {
      name: 'Goals Over/Under',
      entries: [
        ['Over 1.5', markets.overUnder['1.5'].over, 1.5],
        ['Under 1.5', markets.overUnder['1.5'].under, 1.5],
        ['Over 2.5', markets.overUnder['2.5'].over, 2.5],
        ['Under 2.5', markets.overUnder['2.5'].under, 2.5],
      ],
    },
    {
      name: 'Both Teams Score',
      entries: [
        ['Yes', markets.btts.yes, null],
        ['No', markets.btts.no, null],
      ],
    },
  ];

  for (const marketDef of marketDefs) {
    const marketId = await oddsRepo.upsertMarket(null, marketDef.name);
    for (const [selection, probability, handicap] of marketDef.entries) {
      if (!(probability > 0)) continue;
      const fairOdds = 1 / probability;
      const marketInefficiency = 0.85 + Math.random() * 0.3; // 0.85–1.15 -> a veces genera edge real
      const oddsDecimal = Math.max(1.01, Number((fairOdds * marketInefficiency).toFixed(2)));
      await oddsRepo.insertOddsSnapshot({ matchId, bookmakerId, marketId, selection, handicap, oddsDecimal });
    }
  }
}

/** Garantiza al menos MIN_UPCOMING_PER_LEAGUE partidos programados (próximas 48h) para una liga. */
async function ensureUpcomingFixtures(leagueKey, leagueId, seasonId, teamIds) {
  const roster = LEAGUE_ROSTERS[leagueKey];

  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM matches
     WHERE league_id = $1 AND status = 'scheduled' AND kickoff_at BETWEEN now() AND now() + interval '48 hours'`,
    [leagueId]
  );
  const missing = MIN_UPCOMING_PER_LEAGUE - rows[0].count;
  if (missing <= 0) return 0;

  let created = 0;
  for (let i = 0; i < missing; i += 1) {
    const [homeName, awayName] = [...roster].sort(() => Math.random() - 0.5);
    const { homeXG, awayXG } = computeMatchXG(homeName, awayName);

    const providerFixtureId = 700000000 + leagueId * 1000000 + Math.floor(Math.random() * 900000);
    const kickoffAt = new Date(Date.now() + (2 + Math.random() * 46) * 3600 * 1000);

    const matchId = await matchRepo.upsertMatch({
      providerFixtureId,
      leagueId,
      seasonId,
      venueId: null,
      refereeId: null,
      homeTeamId: teamIds[homeName],
      awayTeamId: teamIds[awayName],
      round: 'Jornada Automática',
      kickoffAt,
      status: 'scheduled',
      statusDetail: 'NS',
      homeGoals: null,
      awayGoals: null,
      homeGoalsHt: null,
      awayGoalsHt: null,
    });

    await generateOddsForFixture(matchId, homeXG, awayXG);
    created += 1;
  }
  return created;
}

/** Nuevo snapshot de cuotas para los partidos del simulador ya programados — así el mercado se mueve entre corridas. */
async function refreshOddsForScheduledFixtures(leagueId) {
  const { rows } = await query(
    `SELECT m.id, ht.name AS "homeName", at.name AS "awayName"
     FROM matches m
     JOIN teams ht ON ht.id = m.home_team_id
     JOIN teams at ON at.id = m.away_team_id
     WHERE m.league_id = $1 AND m.status = 'scheduled'
       AND m.kickoff_at BETWEEN now() AND now() + interval '48 hours'
       AND ht.provider_team_id BETWEEN $2 AND $3`,
    [leagueId, SIM_TEAM_ID_MIN, SIM_TEAM_ID_MAX]
  );

  let refreshed = 0;
  for (const m of rows) {
    try {
      const { homeXG, awayXG } = computeMatchXG(m.homeName, m.awayName);
      await generateOddsForFixture(m.id, homeXG, awayXG);
      refreshed += 1;
    } catch (err) {
      logger.warn(`No se pudieron refrescar las cuotas del partido ${m.id}: ${err.message}`);
    }
  }
  return refreshed;
}

/** Genera match_team_stats (xG, posesión, tiros, etc.) para un partido recién finalizado. */
async function insertFinishedMatchStats(match) {
  const buildStats = (goals) => ({
    xg: Number(Math.max(0.3, goals + (Math.random() - 0.5)).toFixed(2)),
    xga: null,
    possessionPct: Number((40 + Math.random() * 20).toFixed(1)),
    dangerousAttacks: 25 + Math.round(Math.random() * 30),
    shotsTotal: 8 + Math.round(Math.random() * 8),
    shotsOnTarget: 3 + Math.round(Math.random() * 5),
    corners: Math.round(Math.random() * 8),
    fouls: 8 + Math.round(Math.random() * 8),
    yellowCards: Math.round(Math.random() * 3),
    redCards: 0,
    passesTotal: null,
    passesAccuratePct: null,
    bigChancesCreated: null,
  });

  await matchRepo.upsertMatchTeamStats(match.id, match.home_team_id, true, buildStats(match.home_goals));
  await matchRepo.upsertMatchTeamStats(match.id, match.away_team_id, false, buildStats(match.away_goals));
}

/**
 * Avanza 'scheduled' -> 'live' -> 'finished' para los partidos del simulador
 * cuyo horario ya pasó. El marcador final se decide (vía Poisson) en el
 * instante en que el partido pasa a 'live' — es una simplificación
 * deliberada (no hay seguimiento minuto a minuto), documentada acá para que
 * quien lea el código no asuma que hay tracking en vivo real.
 */
async function advanceMatchStatuses() {
  let advanced = 0;

  const { rows: toGoLive } = await query(
    `SELECT m.id, ht.name AS "homeName", at.name AS "awayName"
     FROM matches m
     JOIN teams ht ON ht.id = m.home_team_id
     JOIN teams at ON at.id = m.away_team_id
     WHERE m.status = 'scheduled' AND m.kickoff_at <= now()
       AND ht.provider_team_id BETWEEN $1 AND $2`,
    [SIM_TEAM_ID_MIN, SIM_TEAM_ID_MAX]
  );

  for (const m of toGoLive) {
    try {
      const { homeXG, awayXG } = computeMatchXG(m.homeName, m.awayName);
      const homeGoals = samplePoisson(homeXG);
      const awayGoals = samplePoisson(awayXG);
      await query(
        `UPDATE matches SET status = 'live', status_detail = '1H', home_goals = $2, away_goals = $3, updated_at = now()
         WHERE id = $1`,
        [m.id, homeGoals, awayGoals]
      );
      advanced += 1;
    } catch (err) {
      logger.warn(`No se pudo simular el marcador del partido ${m.id}: ${err.message}`);
    }
  }

  // Progresión cosmética del minuto de juego (1H/HT/2H) para los que siguen 'live'.
  await query(
    `UPDATE matches SET status_detail = CASE
       WHEN now() - kickoff_at < interval '45 minutes' THEN '1H'
       WHEN now() - kickoff_at < interval '60 minutes' THEN 'HT'
       ELSE '2H'
     END
     WHERE status = 'live'`
  );

  const { rows: toFinish } = await query(
    `SELECT id, home_team_id, away_team_id, home_goals, away_goals FROM matches
     WHERE status = 'live' AND kickoff_at <= now() - ($1 || ' minutes')::interval`,
    [LIVE_DURATION_MINUTES]
  );

  for (const m of toFinish) {
    await query(`UPDATE matches SET status = 'finished', status_detail = 'FT', updated_at = now() WHERE id = $1`, [m.id]);
    await insertFinishedMatchStats(m);
    advanced += 1;
  }

  return advanced;
}

/** Punto de entrada del cron: una corrida completa del simulador, con trazabilidad vía ingestion_runs. */
async function simulateTick() {
  return runJob('match_simulator', async (ctx) => {
    const { leagueIds, seasonIds, teamIds } = await ensureCatalog();

    for (const leagueKey of Object.keys(LEAGUES)) {
      const leagueId = leagueIds[leagueKey];
      try {
        const created = await ensureUpcomingFixtures(leagueKey, leagueId, seasonIds[leagueKey], teamIds);
        const refreshed = await refreshOddsForScheduledFixtures(leagueId);
        ctx.trackProcessed(created + refreshed);
      } catch (err) {
        await ctx.reportError('league', leagueKey, err);
      }
    }

    try {
      const advanced = await advanceMatchStatuses();
      ctx.trackProcessed(advanced);
    } catch (err) {
      await ctx.reportError('advance_statuses', 'all', err);
    }
  });
}

module.exports = { simulateTick, ensureCatalog, ensureUpcomingFixtures, advanceMatchStatuses };
