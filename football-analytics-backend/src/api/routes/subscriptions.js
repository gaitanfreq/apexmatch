const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { validate } = require('../middleware/validate');
const { emailBody } = require('../schemas');
const subscriptionService = require('../../services/subscriptionService');
const subscriptionRepo = require('../../repositories/subscriptionRepository');

const router = express.Router();

/**
 * POST /api/subscriptions/checkout
 * Crea una sesión de Stripe Checkout (modo suscripción) para el plan VIP y
 * devuelve la URL a la que el frontend debe redirigir al usuario.
 */
router.post(
  '/checkout',
  validate({ body: emailBody }),
  asyncHandler(async (req, res) => {
    const { checkoutUrl, sessionId } = await subscriptionService.createCheckoutSession(req.body.email);
    res.json({ checkoutUrl, sessionId });
  })
);

/**
 * GET /api/subscriptions/me
 * Estado de cuenta del usuario autenticado (requiere Bearer JWT, ver /api/auth/login).
 */
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthorized', message: 'Falta token de sesión.' });
    }
    const subscription = await subscriptionRepo.getByUserId(req.user.id);
    res.json({
      email: req.user.email,
      role: req.user.role,
      plan: subscription?.plan ?? 'free',
      status: subscription?.status ?? 'inactive',
      currentPeriodEnd: subscription?.current_period_end ?? null,
      cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
    });
  })
);

module.exports = router;
