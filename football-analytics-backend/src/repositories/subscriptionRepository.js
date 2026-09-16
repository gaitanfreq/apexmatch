const { query } = require('../db/pool');

async function getByUserId(userId) {
  const { rows } = await query('SELECT * FROM subscriptions WHERE user_id = $1', [userId]);
  return rows[0] ?? null;
}

async function getByStripeCustomerId(stripeCustomerId) {
  const { rows } = await query('SELECT * FROM subscriptions WHERE stripe_customer_id = $1', [stripeCustomerId]);
  return rows[0] ?? null;
}

async function getByStripeSubscriptionId(stripeSubscriptionId) {
  const { rows } = await query('SELECT * FROM subscriptions WHERE stripe_subscription_id = $1', [
    stripeSubscriptionId,
  ]);
  return rows[0] ?? null;
}

async function upsertForUser(userId, {
  plan = 'free',
  status = 'inactive',
  stripeCustomerId = null,
  stripeSubscriptionId = null,
  currentPeriodEnd = null,
  cancelAtPeriodEnd = false,
} = {}) {
  const { rows } = await query(
    `INSERT INTO subscriptions (
       user_id, plan, status, stripe_customer_id, stripe_subscription_id,
       current_period_end, cancel_at_period_end
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (user_id) DO UPDATE SET
       plan = EXCLUDED.plan,
       status = EXCLUDED.status,
       stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
       stripe_subscription_id = EXCLUDED.stripe_subscription_id,
       current_period_end = EXCLUDED.current_period_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       updated_at = now()
     RETURNING *`,
    [userId, plan, status, stripeCustomerId, stripeSubscriptionId, currentPeriodEnd, cancelAtPeriodEnd]
  );
  return rows[0];
}

async function hasWebhookEventBeenProcessed(stripeEventId) {
  const { rows } = await query('SELECT 1 FROM stripe_webhook_events WHERE stripe_event_id = $1', [stripeEventId]);
  return rows.length > 0;
}

async function markWebhookEventProcessed(stripeEventId, type) {
  await query(
    `INSERT INTO stripe_webhook_events (stripe_event_id, type) VALUES ($1, $2)
     ON CONFLICT (stripe_event_id) DO NOTHING`,
    [stripeEventId, type]
  );
}

module.exports = {
  getByUserId,
  getByStripeCustomerId,
  getByStripeSubscriptionId,
  upsertForUser,
  hasWebhookEventBeenProcessed,
  markWebhookEventProcessed,
};
