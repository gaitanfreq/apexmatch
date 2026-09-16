/**
 * Servicio de suscripciones freemium, listo para conectar con Stripe.
 *
 * Diseño: las dependencias (repos de usuario/suscripción, cliente Stripe) se
 * reciben por parámetro con defaults a las implementaciones reales, para que
 * `handleStripeEvent` sea testeable inyectando fakes sin tocar la base de
 * datos ni la red (ver `test/api/subscriptionService.test.js`).
 */
const defaultUserRepo = require('../repositories/userRepository');
const defaultSubscriptionRepo = require('../repositories/subscriptionRepository');
const { getStripeClient } = require('./stripeClient');
const config = require('../config');
const logger = require('../utils/logger');

/** Crea una sesión de Stripe Checkout para que el usuario se suscriba al plan VIP. */
async function createCheckoutSession(email, {
  userRepo = defaultUserRepo,
  subscriptionRepo = defaultSubscriptionRepo,
  stripe = getStripeClient(),
} = {}) {
  if (!config.stripe.vipPriceId) {
    throw new Error('STRIPE_VIP_PRICE_ID is not configured');
  }

  const user = await userRepo.upsertUserByEmail(email);
  const existingSubscription = await subscriptionRepo.getByUserId(user.id);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: email,
    customer: existingSubscription?.stripe_customer_id ?? undefined,
    line_items: [{ price: config.stripe.vipPriceId, quantity: 1 }],
    success_url: config.stripe.successUrl,
    cancel_url: config.stripe.cancelUrl,
    metadata: { userId: String(user.id) },
    subscription_data: { metadata: { userId: String(user.id) } },
  });

  return { checkoutUrl: session.url, sessionId: session.id };
}

/**
 * Procesa un evento de webhook de Stripe ya verificado (firma validada por el
 * caller, ver `src/api/routes/webhooks.js`). Idempotente: un mismo
 * `event.id` reenviado por Stripe no se procesa dos veces.
 */
async function handleStripeEvent(event, {
  userRepo = defaultUserRepo,
  subscriptionRepo = defaultSubscriptionRepo,
} = {}) {
  const alreadyProcessed = await subscriptionRepo.hasWebhookEventBeenProcessed(event.id);
  if (alreadyProcessed) {
    logger.info(`Stripe event ${event.id} already processed, skipping`);
    return { skipped: true };
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = Number(session.metadata?.userId);
      const user = userId ? await userRepo.getUserById(userId) : await userRepo.getUserByEmail(session.customer_email);

      if (!user) {
        logger.warn('checkout.session.completed: no matching user found', { sessionId: session.id });
        break;
      }

      await subscriptionRepo.upsertForUser(user.id, {
        plan: 'vip',
        status: 'active',
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
      });
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const existing = await subscriptionRepo.getByStripeSubscriptionId(subscription.id)
        ?? await subscriptionRepo.getByStripeCustomerId(subscription.customer);

      if (!existing) {
        logger.warn('customer.subscription.updated: no local subscription found', {
          stripeSubscriptionId: subscription.id,
        });
        break;
      }

      const isActive = ['active', 'trialing'].includes(subscription.status);
      await subscriptionRepo.upsertForUser(existing.user_id, {
        plan: isActive ? 'vip' : 'free',
        status: subscription.status,
        stripeCustomerId: subscription.customer,
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const existing = await subscriptionRepo.getByStripeSubscriptionId(subscription.id);

      if (!existing) {
        logger.warn('customer.subscription.deleted: no local subscription found', {
          stripeSubscriptionId: subscription.id,
        });
        break;
      }

      await subscriptionRepo.upsertForUser(existing.user_id, {
        plan: 'free',
        status: 'canceled',
        stripeCustomerId: subscription.customer,
        stripeSubscriptionId: subscription.id,
      });
      break;
    }

    default:
      logger.debug(`Unhandled Stripe event type: ${event.type}`);
  }

  await subscriptionRepo.markWebhookEventProcessed(event.id, event.type);
  return { skipped: false };
}

module.exports = { createCheckoutSession, handleStripeEvent };
