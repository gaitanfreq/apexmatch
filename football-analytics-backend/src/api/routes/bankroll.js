const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { bankrollSettingsBody, registerBetBody, betIdParam } = require('../schemas');
const bankrollRepo = require('../../repositories/bankrollRepository');
const { computePerformanceStats } = require('../../analytics/performanceStats');

const router = express.Router();

// Todo el Bankroll Tracker es personal: requiere cualquier sesión autenticada
// (free, vip o admin) — ver requireAuth. Los datos siempre se filtran por req.user.id.
router.use(requireAuth);

/**
 * GET /api/bankroll/settings
 * Bankroll inicial y unidad de stake configurados por el usuario (o los
 * valores por defecto — $1,000 / $25 fijo — si todavía no configuró nada).
 */
router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const settings = await bankrollRepo.getSettings(req.user.id);
    res.json(settings);
  })
);

/**
 * PUT /api/bankroll/settings
 * Guarda/actualiza el bankroll inicial y la unidad de stake (monto fijo o %).
 */
router.put(
  '/settings',
  validate({ body: bankrollSettingsBody }),
  asyncHandler(async (req, res) => {
    const settings = await bankrollRepo.upsertSettings(req.user.id, req.body);
    res.json(settings);
  })
);

/**
 * GET /api/bankroll/stats
 * ROI, % de aciertos, total de apuestas registradas, bankroll actual y la
 * curva de crecimiento — calculados dinámicamente a partir de las apuestas
 * del usuario (user_bets) sobre su bankroll inicial configurado.
 */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const [settings, bets] = await Promise.all([
      bankrollRepo.getSettings(req.user.id),
      bankrollRepo.listBets(req.user.id),
    ]);

    const settledHistory = bets.map((bet) => ({
      stakeAmount: bet.stakeAmount,
      profitLoss: bet.profitLoss,
      status: bet.result,
      settledAt: bet.placedAt,
    }));

    const stats = computePerformanceStats(settledHistory, { startingBankroll: settings.initialBankroll });

    res.json({ generatedAt: new Date().toISOString(), settings, ...stats });
  })
);

/**
 * GET /api/bankroll/bets
 * Historial completo de apuestas registradas manualmente por el usuario.
 */
router.get(
  '/bets',
  asyncHandler(async (req, res) => {
    const bets = await bankrollRepo.listBets(req.user.id);
    res.json({ count: bets.length, bets: [...bets].reverse() }); // más recientes primero
  })
);

/**
 * POST /api/bankroll/bets
 * Registra una apuesta ya resuelta (Partido, Cuota, Stake, Resultado). La
 * ganancia/pérdida se calcula en el servidor a partir de cuota+stake+resultado.
 */
router.post(
  '/bets',
  validate({ body: registerBetBody }),
  asyncHandler(async (req, res) => {
    const bet = await bankrollRepo.insertBet(req.user.id, req.body);
    res.status(201).json(bet);
  })
);

/**
 * DELETE /api/bankroll/bets/:id
 * Elimina una apuesta registrada (solo si pertenece al usuario autenticado).
 */
router.delete(
  '/bets/:id',
  validate({ params: betIdParam }),
  asyncHandler(async (req, res) => {
    const deleted = await bankrollRepo.deleteBet(req.user.id, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'not_found', message: 'Apuesta no encontrada.' });
    }
    res.status(204).end();
  })
);

module.exports = router;
