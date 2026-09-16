-- ============================================================================
-- 007_performance_tracking.sql
-- Registro histórico de recomendaciones (value bets / paquetes) para calcular
-- ROI, % de aciertos y la curva de bankroll expuestos en /api/stats/performance.
-- ============================================================================

CREATE TABLE recommendation_records (
    id                      BIGSERIAL PRIMARY KEY,
    kind                    VARCHAR(20) NOT NULL, -- 'value_bet' | 'low_risk_package'
    match_ids                INTEGER[] NOT NULL,
    legs                       JSONB NOT NULL, -- snapshot de las legs (market/selection/probability/odds)
    combined_odds               NUMERIC(8,3) NOT NULL,
    model_probability             NUMERIC(6,4) NOT NULL,
    kelly_stake_fraction           NUMERIC(6,4),
    stake_amount                     NUMERIC(10,2),
    status                             VARCHAR(10) NOT NULL DEFAULT 'pending', -- pending | won | lost | void
    profit_loss                        NUMERIC(10,2),
    bankroll_before                      NUMERIC(10,2),
    bankroll_after                        NUMERIC(10,2),
    recommended_at                         TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at                              TIMESTAMPTZ
);

CREATE INDEX idx_recommendation_records_kind ON recommendation_records(kind);
CREATE INDEX idx_recommendation_records_status ON recommendation_records(status);
CREATE INDEX idx_recommendation_records_recommended_at ON recommendation_records(recommended_at);
