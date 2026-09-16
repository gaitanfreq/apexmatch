-- ============================================================================
-- 009_user_bankroll.sql
-- Bankroll Tracker personal: configuración (bankroll inicial, unidad de
-- stake) y bitácora de apuestas por usuario. Independiente de
-- `recommendation_records` (migración 007), que alimenta las métricas
-- públicas del algoritmo en el Dashboard gratuito — esto es la bitácora
-- privada de cada usuario autenticado.
-- ============================================================================

CREATE TABLE user_bankroll_settings (
    user_id             INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    initial_bankroll     NUMERIC(12,2) NOT NULL DEFAULT 1000 CHECK (initial_bankroll > 0),
    stake_unit_type        VARCHAR(10) NOT NULL DEFAULT 'fixed' CHECK (stake_unit_type IN ('fixed', 'percentage')),
    stake_unit_value          NUMERIC(12,2) NOT NULL DEFAULT 25 CHECK (stake_unit_value > 0),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_bets (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_label          TEXT NOT NULL,
    market                 TEXT,
    odds_decimal             NUMERIC(7,3) NOT NULL CHECK (odds_decimal > 1),
    stake_amount               NUMERIC(12,2) NOT NULL CHECK (stake_amount > 0),
    result                        VARCHAR(10) NOT NULL CHECK (result IN ('won', 'lost', 'void')),
    profit_loss                    NUMERIC(12,2) NOT NULL,
    placed_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at                         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_bets_user_placed ON user_bets(user_id, placed_at);
