-- ============================================================================
-- 004_odds_and_bookmakers.sql
-- Casas de apuestas, mercados y cuotas históricas (serie temporal por partido).
-- ============================================================================

CREATE TABLE bookmakers (
    id                  SERIAL PRIMARY KEY,
    provider_bookmaker_id INTEGER UNIQUE,
    name                TEXT NOT NULL UNIQUE
);

CREATE TABLE odds_markets (
    id                  SERIAL PRIMARY KEY,
    provider_market_id  INTEGER UNIQUE,
    name                TEXT NOT NULL UNIQUE -- ej. 'Match Winner', 'Over/Under 2.5', 'Both Teams Score'
);

-- Cada fila = una cotización de una apuesta (bookmaker x market x selección) en un instante.
-- Es append-only: para ver la evolución de la cuota se consulta por (match_id, market, bookmaker)
-- ordenado por captured_at. No se hace UPDATE sobre filas existentes.
CREATE TABLE odds_snapshots (
    id                  BIGSERIAL PRIMARY KEY,
    match_id             INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    bookmaker_id          INTEGER NOT NULL REFERENCES bookmakers(id),
    market_id             INTEGER NOT NULL REFERENCES odds_markets(id),
    selection              TEXT NOT NULL, -- ej. 'Home', 'Draw', 'Away', 'Over 2.5'
    handicap                NUMERIC(5,2), -- para mercados con línea (ej. Asian handicap, Over/Under)
    odds_decimal             NUMERIC(7,3) NOT NULL,
    is_closing_line           BOOLEAN NOT NULL DEFAULT false,
    captured_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consultas típicas: última cuota por partido/mercado/bookmaker, o evolución completa.
CREATE INDEX idx_odds_snapshots_match ON odds_snapshots(match_id);
CREATE INDEX idx_odds_snapshots_lookup
    ON odds_snapshots(match_id, market_id, bookmaker_id, captured_at DESC);
CREATE INDEX idx_odds_snapshots_closing
    ON odds_snapshots(match_id, market_id) WHERE is_closing_line = true;

-- Vista de conveniencia: última cuota conocida por partido/mercado/bookmaker/selección.
CREATE VIEW odds_latest AS
SELECT DISTINCT ON (match_id, bookmaker_id, market_id, selection, handicap)
    match_id, bookmaker_id, market_id, selection, handicap, odds_decimal, captured_at
FROM odds_snapshots
ORDER BY match_id, bookmaker_id, market_id, selection, handicap, captured_at DESC;
