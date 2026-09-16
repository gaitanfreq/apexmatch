/**
 * Prueba `handleStripeEvent` inyectando repos en memoria (fakes), sin tocar
 * la base de datos real ni la red de Stripe — valida la lógica de negocio
 * de las transiciones de plan freemium ante eventos de webhook.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { handleStripeEvent } = require('../../src/services/subscriptionService');

function createFakeRepos({ users = [], subscriptions = [] } = {}) {
  const processedEvents = new Set();

  const userRepo = {
    async getUserById(id) {
      return users.find((u) => u.id === id) ?? null;
    },
    async getUserByEmail(email) {
      return users.find((u) => u.email === email) ?? null;
    },
  };

  const subscriptionRepo = {
    async getByUserId(userId) {
      return subscriptions.find((s) => s.user_id === userId) ?? null;
    },
    async getByStripeSubscriptionId(id) {
      return subscriptions.find((s) => s.stripe_subscription_id === id) ?? null;
    },
    async getByStripeCustomerId(id) {
      return subscriptions.find((s) => s.stripe_customer_id === id) ?? null;
    },
    async upsertForUser(userId, patch) {
      let sub = subscriptions.find((s) => s.user_id === userId);
      if (!sub) {
        sub = { user_id: userId };
        subscriptions.push(sub);
      }
      Object.assign(sub, {
        plan: patch.plan,
        status: patch.status,
        stripe_customer_id: patch.stripeCustomerId ?? sub.stripe_customer_id,
        stripe_subscription_id: patch.stripeSubscriptionId ?? sub.stripe_subscription_id,
        current_period_end: patch.currentPeriodEnd ?? sub.current_period_end,
        cancel_at_period_end: patch.cancelAtPeriodEnd ?? sub.cancel_at_period_end,
      });
      return sub;
    },
    async hasWebhookEventBeenProcessed(eventId) {
      return processedEvents.has(eventId);
    },
    async markWebhookEventProcessed(eventId) {
      processedEvents.add(eventId);
    },
  };

  return { userRepo, subscriptionRepo, subscriptions, processedEvents };
}

describe('subscriptionService.handleStripeEvent', () => {
  test('checkout.session.completed activa el plan VIP para el usuario', async () => {
    const { userRepo, subscriptionRepo, subscriptions } = createFakeRepos({
      users: [{ id: 1, email: 'ana@example.com' }],
    });

    const event = {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          customer: 'cus_123',
          subscription: 'sub_123',
          customer_email: 'ana@example.com',
          metadata: { userId: '1' },
        },
      },
    };

    await handleStripeEvent(event, { userRepo, subscriptionRepo });

    assert.equal(subscriptions.length, 1);
    assert.equal(subscriptions[0].plan, 'vip');
    assert.equal(subscriptions[0].status, 'active');
    assert.equal(subscriptions[0].stripe_customer_id, 'cus_123');
  });

  test('customer.subscription.deleted revierte el plan a free', async () => {
    const { userRepo, subscriptionRepo, subscriptions } = createFakeRepos({
      users: [{ id: 1, email: 'ana@example.com' }],
      subscriptions: [{ user_id: 1, plan: 'vip', status: 'active', stripe_subscription_id: 'sub_123' }],
    });

    const event = {
      id: 'evt_2',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_123', customer: 'cus_123' } },
    };

    await handleStripeEvent(event, { userRepo, subscriptionRepo });

    assert.equal(subscriptions[0].plan, 'free');
    assert.equal(subscriptions[0].status, 'canceled');
  });

  test('customer.subscription.updated con status "past_due" degrada el plan a free', async () => {
    const { userRepo, subscriptionRepo, subscriptions } = createFakeRepos({
      users: [{ id: 1, email: 'ana@example.com' }],
      subscriptions: [{ user_id: 1, plan: 'vip', status: 'active', stripe_subscription_id: 'sub_123' }],
    });

    const event = {
      id: 'evt_3',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_123',
          status: 'past_due',
          current_period_end: Math.floor(Date.now() / 1000),
          cancel_at_period_end: false,
        },
      },
    };

    await handleStripeEvent(event, { userRepo, subscriptionRepo });

    assert.equal(subscriptions[0].plan, 'free');
    assert.equal(subscriptions[0].status, 'past_due');
  });

  test('un mismo evento reenviado por Stripe es idempotente (no se procesa dos veces)', async () => {
    const { userRepo, subscriptionRepo, subscriptions } = createFakeRepos({
      users: [{ id: 1, email: 'ana@example.com' }],
    });

    const event = {
      id: 'evt_4',
      type: 'checkout.session.completed',
      data: {
        object: { id: 'cs_1', customer: 'cus_123', subscription: 'sub_123', metadata: { userId: '1' } },
      },
    };

    const first = await handleStripeEvent(event, { userRepo, subscriptionRepo });
    // Simula un segundo intento del mismo evento con un customer distinto:
    // si no fuera idempotente, sobrescribiría el estado ya procesado.
    event.data.object.customer = 'cus_should_be_ignored';
    const second = await handleStripeEvent(event, { userRepo, subscriptionRepo });

    assert.equal(first.skipped, false);
    assert.equal(second.skipped, true);
    assert.equal(subscriptions[0].stripe_customer_id, 'cus_123');
  });

  test('evento sin usuario correspondiente no lanza excepción', async () => {
    const { userRepo, subscriptionRepo, subscriptions } = createFakeRepos();

    const event = {
      id: 'evt_5',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', customer: 'cus_999', metadata: {} } },
    };

    await handleStripeEvent(event, { userRepo, subscriptionRepo });
    assert.equal(subscriptions.length, 0);
  });
});
