-- ============================================================================
-- 010_predictions_cache.sql
-- Caché de predicciones (xG/Poisson/value bets) por partido, generada
-- automáticamente por el job `predictions-refresh` (ver src/ingestion/
-- predictionsRefresh.js) sobre los partidos programados. Las vistas de
-- "Value Bets" y "Live Predictions" leen de acá primero, con fallback a
-- cálculo en vivo si la caché está vacía o vencida (ver matchdayService.js).
-- ============================================================================

CREATE TABLE match_predictions_cache (
    match_id        INTEGER PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
    home_xg          NUMERIC(6,3) NOT NULL,
    away_xg            NUMERIC(6,3) NOT NULL,
    markets              JSONB NOT NULL,
    top_scores            JSONB NOT NULL,
    value_bets              JSONB NOT NULL DEFAULT '[]'::jsonb,
    computed_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_match_predictions_cache_computed_at ON match_predictions_cache(computed_at);
