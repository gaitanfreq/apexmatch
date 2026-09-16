const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const matchdayService = require('../services/matchdayService');

const router = express.Router();

/**
 * GET /api/stats/performance
 *
 * Métricas históricas del algoritmo: ROI%, % de aciertos y la curva de
 * evolución del bankroll. Es contenido público (Sección Gratuita) — sirve
 * como prueba social/tracción, por eso no está gateado por VIP.
 */
router.get(
  '/performance',
  asyncHandler(async (_req, res) => {
    const stats = await matchdayService.getPerformanceStats();
    res.json({ generatedAt: new Date().toISOString(), ...stats });
  })
);

module.exports = router;
