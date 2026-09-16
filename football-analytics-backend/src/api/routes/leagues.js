const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const matchdayService = require('../services/matchdayService');

const router = express.Router();

/**
 * GET /api/leagues
 *
 * Ligas trackeadas con partidos en el sistema (UEFA Champions League, La
 * Liga, Premier League, Serie A, etc. — según TRACKED_LEAGUE_IDS en el
 * backfill), con el conteo de partidos programados/en vivo/finalizados.
 * Alimenta el filtro de liga de Live Predictions. Contenido público.
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const leagues = await matchdayService.getTrackedLeagues();
    res.json({ count: leagues.length, leagues });
  })
);

module.exports = router;
