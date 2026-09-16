const Stripe = require('stripe');
const config = require('../config');

let stripeInstance = null;

/** Lazy singleton: evita reventar en `require()` cuando STRIPE_SECRET_KEY no está seteado (ej. en tests). */
function getStripeClient() {
  if (!config.stripe.secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(config.stripe.secretKey, { apiVersion: '2024-06-20' });
  }
  return stripeInstance;
}

module.exports = { getStripeClient };
