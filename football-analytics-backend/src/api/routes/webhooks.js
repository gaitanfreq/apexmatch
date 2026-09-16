const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { getStripeClient } = require('../../services/stripeClient');
const subscriptionService = require('../../services/subscriptionService');
const config = require('../../config');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * POST /api/webhooks/stripe
 *
 * Requiere el body SIN parsear (raw) para poder verificar la firma HMAC de
 * Stripe — ver el montaje de `express.raw()` para esta ruta específica en
 * `src/api/app.js`, que debe registrarse ANTES del `express.json()` global.
 */
router.post(
  '/stripe',
  asyncHandler(async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!config.stripe.webhookSecret) {
      logger.error('STRIPE_WEBHOOK_SECRET not configured; rejecting webhook');
      return res.status(500).json({ error: 'webhook_not_configured' });
    }

    let event;
    try {
      const stripe = getStripeClient();
      event = stripe.webhooks.constructEvent(req.body, signature, config.stripe.webhookSecret);
    } catch (err) {
      logger.warn('Stripe webhook signature verification failed', { error: err.message });
      return res.status(400).json({ error: 'invalid_signature' });
    }

    await subscriptionService.handleStripeEvent(event);
    res.json({ received: true });
  })
);

module.exports = router;
