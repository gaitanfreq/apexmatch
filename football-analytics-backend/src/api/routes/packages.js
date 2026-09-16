const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { validate } = require('../middleware/validate');
const { upcomingWindowQuery } = require('../schemas');
const matchdayService = require('../services/matchdayService');

const router = express.Router();

/**
 * GET /api/packages/low-risk
 *
 * Paquetes combinados (Doble Oportunidad, Más de 1.5 goles, Ambos Anotan)
 * con probabilidad acumulada proyectada > 85%. Contenido de la Sección
 * Gratuita del freemium — no requiere autenticación.
 *
 * Query params: withinHours (1-336, default 72), leagueIds ("39,140").
 */
router.get(
  '/low-risk',
  validate({ query: upcomingWindowQuery }),
  asyncHandler(async (req, res) => {
    const { withinHours = 72, leagueIds } = req.query;
    const result = await matchdayService.getLowRiskPackages({ withinHours, leagueIds });
    res.json({ generatedAt: new Date().toISOString(), ...result });
  })
);

module.exports = router;
