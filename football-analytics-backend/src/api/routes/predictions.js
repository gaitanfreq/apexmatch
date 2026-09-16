const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { validate } = require('../middleware/validate');
const { upcomingWindowQuery, liveWindowQuery } = require('../schemas');
const { hasFullAccess } = require('../middleware/auth');
const matchdayService = require('../services/matchdayService');

const router = express.Router();

/**
 * GET /api/predictions/today
 *
 * Pronósticos procesados para los partidos del día (por defecto, las
 * próximas 24h): xG estimado, probabilidades 1X2/doble oportunidad/over-under/BTTS.
 * Los marcadores exactos ("topScores") son contenido VIP — se ocultan para
 * usuarios sin plan activo.
 *
 * Query params: withinHours (1-336, default 24), leagueIds ("39,140").
 */
router.get(
  '/today',
  validate({ query: upcomingWindowQuery }),
  asyncHandler(async (req, res) => {
    const { withinHours = 24, leagueIds } = req.query;
    const predictions = await matchdayService.getPredictions({ withinHours, leagueIds });
    const unlocked = hasFullAccess(req.user);

    const payload = predictions.map(({ fixture, xgEstimate, prediction }) => ({
      fixture: {
        id: fixture.id,
        leagueId: fixture.leagueId,
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        homeTeamName: fixture.homeTeamName,
        awayTeamName: fixture.awayTeamName,
        kickoffAt: fixture.kickoffAt,
      },
      expectedGoals: { home: xgEstimate.homeXG, away: xgEstimate.awayXG },
      markets: prediction.markets,
      topScores: unlocked ? prediction.topScores : null,
      vipLocked: unlocked ? [] : ['topScores'],
    }));

    res.json({ count: payload.length, generatedAt: new Date().toISOString(), predictions: payload });
  })
);

/**
 * GET /api/predictions/live
 *
 * Vista general del módulo de Ligas/Competiciones/Partidos: partidos
 * programados, en juego y/o finalizados (según `statuses`), filtrables por
 * liga — soporta el selector de liga y los distintos estados de Live
 * Predictions. Solo se calcula xG/Poisson/value bet para partidos
 * 'scheduled'; los en juego/finalizados devuelven equipos+liga+marcador sin
 * intentar "predecir" un resultado que ya se está jugando o ya ocurrió.
 *
 * Query params: withinHours (1-336, default 48), leagueIds ("39,140"),
 * statuses ("scheduled,live,finished", default "scheduled,live").
 */
router.get(
  '/live',
  validate({ query: liveWindowQuery }),
  asyncHandler(async (req, res) => {
    const { withinHours = 48, leagueIds, statuses } = req.query;
    const overview = await matchdayService.getFixturesOverview({ withinHours, leagueIds, statuses });
    const unlocked = hasFullAccess(req.user);

    const payload = overview.map(({ fixture, xgEstimate, prediction, valueBets }) => {
      const base = {
        fixture: {
          id: fixture.id,
          leagueId: fixture.leagueId,
          leagueName: fixture.leagueName,
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          homeTeamName: fixture.homeTeamName,
          awayTeamName: fixture.awayTeamName,
          kickoffAt: fixture.kickoffAt,
          status: fixture.status,
          statusDetail: fixture.statusDetail,
          homeGoals: fixture.homeGoals,
          awayGoals: fixture.awayGoals,
        },
      };

      if (!prediction) {
        return { ...base, expectedGoals: null, markets: null, topScores: null, vipLocked: [], valueBet: null };
      }

      const bestValueBet = [...valueBets].sort((a, b) => b.edge - a.edge)[0] ?? null;

      return {
        ...base,
        expectedGoals: { home: xgEstimate.homeXG, away: xgEstimate.awayXG },
        markets: prediction.markets,
        topScores: unlocked ? prediction.topScores : null,
        vipLocked: unlocked ? [] : ['topScores'],
        valueBet: bestValueBet
          ? { hasValue: true, edge: unlocked ? bestValueBet.edge : null, locked: !unlocked }
          : { hasValue: false, edge: null, locked: false },
      };
    });

    res.json({ count: payload.length, generatedAt: new Date().toISOString(), fixtures: payload });
  })
);

module.exports = router;
