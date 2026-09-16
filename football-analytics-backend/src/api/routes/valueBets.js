const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { validate } = require('../middleware/validate');
const { requireVip } = require('../middleware/auth');
const { valueBetsQuery } = require('../schemas');
const matchdayService = require('../services/matchdayService');

const router = express.Router();

/**
 * GET /api/value-bets
 *
 * Apuestas con edge (margen sobre la cuota del bookmaker) >= minEdge (5% por
 * defecto). Muro de pago VIP: requiere un JWT Bearer con plan activo
 * (ver POST /api/subscriptions/checkout y POST /api/auth/session).
 *
 * Query params: withinHours (1-336, default 72), leagueIds, minEdge (0-1).
 */
router.get(
  '/',
  validate({ query: valueBetsQuery }),
  requireVip,
  asyncHandler(async (req, res) => {
    const { withinHours = 72, leagueIds, minEdge } = req.query;
    const valueBets = await matchdayService.getValueBets({ withinHours, leagueIds, minEdge });
    res.json({ count: valueBets.length, generatedAt: new Date().toISOString(), valueBets });
  })
);

module.exports = router;
