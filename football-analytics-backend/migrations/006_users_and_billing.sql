-- ============================================================================
-- 006_users_and_billing.sql
-- Usuarios y suscripciones (freemium), preparado para Stripe.
-- ============================================================================

CREATE TABLE users (
    id                  SERIAL PRIMARY KEY,
    email               TEXT NOT NULL UNIQUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
    id                      SERIAL PRIMARY KEY,
    user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan                    VARCHAR(20) NOT NULL DEFAULT 'free', -- free | vip
    status                  VARCHAR(30) NOT NULL DEFAULT 'inactive',
        -- inactive | active | trialing | past_due | canceled | incomplete
    stripe_customer_id       TEXT UNIQUE,
    stripe_subscription_id    TEXT UNIQUE,
    current_period_end         TIMESTAMPTZ,
    cancel_at_period_end        BOOLEAN NOT NULL DEFAULT false,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id)
);

CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_plan_status ON subscriptions(plan, status);

-- Idempotencia de webhooks: Stripe puede reenviar el mismo evento más de una vez.
CREATE TABLE stripe_webhook_events (
    id                  BIGSERIAL PRIMARY KEY,
    stripe_event_id      TEXT NOT NULL UNIQUE,
    type                   TEXT NOT NULL,
    processed_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
