-- ============================================================================
-- 001_core_entities.sql
-- Entidades base: países, ligas, temporadas, equipos, venues, árbitros, clima.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE countries (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    code            VARCHAR(3),
    flag_url        TEXT
);

CREATE TABLE leagues (
    id                  SERIAL PRIMARY KEY,
    provider_league_id  INTEGER NOT NULL UNIQUE, -- id de API-Football
    name                TEXT NOT NULL,
    type                VARCHAR(20) NOT NULL DEFAULT 'league', -- league | cup
    country_id          INTEGER REFERENCES countries(id),
    logo_url            TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE seasons (
    id              SERIAL PRIMARY KEY,
    league_id       INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    year            INTEGER NOT NULL,
    start_date      DATE,
    end_date        DATE,
    is_current      BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (league_id, year)
);

CREATE TABLE venues (
    id                  SERIAL PRIMARY KEY,
    provider_venue_id   INTEGER UNIQUE,
    name                TEXT,
    city                TEXT,
    country_id          INTEGER REFERENCES countries(id),
    latitude            NUMERIC(9,6),
    longitude           NUMERIC(9,6),
    surface             TEXT,
    capacity            INTEGER
);

CREATE TABLE teams (
    id                  SERIAL PRIMARY KEY,
    provider_team_id    INTEGER NOT NULL UNIQUE,
    name                TEXT NOT NULL,
    short_code          VARCHAR(10),
    country_id          INTEGER REFERENCES countries(id),
    founded_year        INTEGER,
    is_national_team    BOOLEAN NOT NULL DEFAULT false,
    logo_url            TEXT,
    venue_id            INTEGER REFERENCES venues(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE team_season_stats (
    id                      SERIAL PRIMARY KEY,
    team_id                 INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    season_id               INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    matches_played          INTEGER DEFAULT 0,
    wins                    INTEGER DEFAULT 0,
    draws                   INTEGER DEFAULT 0,
    losses                  INTEGER DEFAULT 0,
    goals_for               INTEGER DEFAULT 0,
    goals_against           INTEGER DEFAULT 0,
    clean_sheets            INTEGER DEFAULT 0,
    avg_xg_for              NUMERIC(5,2),
    avg_xg_against          NUMERIC(5,2),
    avg_possession_pct      NUMERIC(5,2),
    avg_dangerous_attacks   NUMERIC(6,2),
    form_last_5             VARCHAR(5), -- ej. 'WWDLW'
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (team_id, season_id)
);

CREATE TABLE referees (
    id                  SERIAL PRIMARY KEY,
    provider_referee_id INTEGER UNIQUE,
    name                TEXT NOT NULL,
    nationality         TEXT,
    avg_cards_per_match NUMERIC(4,2),
    avg_penalties_per_match NUMERIC(4,2),
    matches_officiated  INTEGER DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_teams_provider_id ON teams(provider_team_id);
CREATE INDEX idx_leagues_provider_id ON leagues(provider_league_id);
CREATE INDEX idx_team_season_stats_team ON team_season_stats(team_id);
