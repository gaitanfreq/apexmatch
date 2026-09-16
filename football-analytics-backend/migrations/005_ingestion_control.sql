-- ============================================================================
-- 005_ingestion_control.sql
-- Control de sincronización y trazabilidad de fallos de integración.
-- ============================================================================

CREATE TABLE ingestion_runs (
    id                  BIGSERIAL PRIMARY KEY,
    job_name             TEXT NOT NULL, -- ej. 'fixtures_backfill', 'odds_poller', 'lineups_poller'
    status                VARCHAR(20) NOT NULL DEFAULT 'running',
        -- running | success | partial | failed
    started_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at             TIMESTAMPTZ,
    records_processed        INTEGER DEFAULT 0,
    records_failed            INTEGER DEFAULT 0,
    error_summary              TEXT,
    metadata                    JSONB
);

CREATE INDEX idx_ingestion_runs_job ON ingestion_runs(job_name, started_at DESC);

-- Cola de errores individuales para reintentos y auditoría
CREATE TABLE ingestion_errors (
    id                  BIGSERIAL PRIMARY KEY,
    ingestion_run_id      BIGINT REFERENCES ingestion_runs(id) ON DELETE CASCADE,
    entity_type             TEXT NOT NULL, -- ej. 'fixture', 'odds', 'injury'
    entity_provider_id       TEXT,
    error_message              TEXT NOT NULL,
    payload                      JSONB,
    retry_count                   INTEGER NOT NULL DEFAULT 0,
    resolved                       BOOLEAN NOT NULL DEFAULT false,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ingestion_errors_unresolved
    ON ingestion_errors(entity_type) WHERE resolved = false;

-- Marca de agua por liga/temporada para saber hasta qué fecha se sincronizó
CREATE TABLE sync_watermarks (
    id                  SERIAL PRIMARY KEY,
    resource               TEXT NOT NULL, -- ej. 'league:39:2025'
    last_synced_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (resource)
);
