-- ============================================================================
-- 002_matches_and_advanced_stats.sql
-- Partidos, estadísticas avanzadas por partido (xG, posesión peligrosa),
-- alineaciones y clima.
-- ============================================================================

CREATE TABLE matches (
    id                  SERIAL PRIMARY KEY,
    provider_fixture_id INTEGER NOT NULL UNIQUE, -- id de API-Football
    league_id           INTEGER NOT NULL REFERENCES leagues(id),
    season_id           INTEGER NOT NULL REFERENCES seasons(id),
    venue_id            INTEGER REFERENCES venues(id),
    referee_id          INTEGER REFERENCES referees(id),
    home_team_id        INTEGER NOT NULL REFERENCES teams(id),
    away_team_id        INTEGER NOT NULL REFERENCES teams(id),
    round               TEXT,
    kickoff_at          TIMESTAMPTZ NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'scheduled',
        -- scheduled | live | finished | postponed | cancelled
    status_detail       TEXT, -- ej. '2H', 'HT', 'FT' segun provider
    home_goals          INTEGER,
    away_goals          INTEGER,
    home_goals_ht       INTEGER,
    away_goals_ht       INTEGER,
    lineups_confirmed_at TIMESTAMPTZ,
    last_synced_at      TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_teams_different CHECK (home_team_id <> away_team_id)
);

CREATE INDEX idx_matches_kickoff ON matches(kickoff_at);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_league_season ON matches(league_id, season_id);
CREATE INDEX idx_matches_home_away ON matches(home_team_id, away_team_id);

-- Métricas avanzadas por equipo dentro de cada partido (una fila por equipo x partido)
CREATE TABLE match_team_stats (
    id                      SERIAL PRIMARY KEY,
    match_id                INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team_id                 INTEGER NOT NULL REFERENCES teams(id),
    is_home                 BOOLEAN NOT NULL,
    xg                      NUMERIC(5,2),
    xga                     NUMERIC(5,2), -- xG concedido en ese partido
    possession_pct          NUMERIC(5,2),
    dangerous_attacks       INTEGER,
    shots_total             INTEGER,
    shots_on_target         INTEGER,
    corners                 INTEGER,
    fouls                   INTEGER,
    yellow_cards            INTEGER,
    red_cards               INTEGER,
    passes_total            INTEGER,
    passes_accurate_pct     NUMERIC(5,2),
    big_chances_created     INTEGER,
    UNIQUE (match_id, team_id)
);

CREATE INDEX idx_match_team_stats_match ON match_team_stats(match_id);
CREATE INDEX idx_match_team_stats_team ON match_team_stats(team_id);

CREATE TABLE match_weather (
    id                  SERIAL PRIMARY KEY,
    match_id            INTEGER NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
    temperature_celsius  NUMERIC(4,1),
    feels_like_celsius   NUMERIC(4,1),
    humidity_pct         NUMERIC(5,2),
    wind_speed_kph       NUMERIC(5,2),
    precipitation_mm     NUMERIC(5,2),
    condition            TEXT, -- ej. 'clear', 'rain', 'snow'
    is_forecast          BOOLEAN NOT NULL DEFAULT true, -- true=pronóstico, false=real/histórico
    source                TEXT,
    fetched_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Historial árbitro <-> equipo (frecuencia de tarjetas/penales cuando dirige a un equipo)
CREATE TABLE referee_team_history (
    id                  SERIAL PRIMARY KEY,
    referee_id          INTEGER NOT NULL REFERENCES referees(id) ON DELETE CASCADE,
    team_id             INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    matches_officiated  INTEGER DEFAULT 0,
    wins                INTEGER DEFAULT 0,
    draws               INTEGER DEFAULT 0,
    losses              INTEGER DEFAULT 0,
    avg_cards_against    NUMERIC(4,2),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (referee_id, team_id)
);

CREATE TABLE lineups (
    id                  SERIAL PRIMARY KEY,
    match_id            INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team_id             INTEGER NOT NULL REFERENCES teams(id),
    formation           VARCHAR(20),
    is_confirmed         BOOLEAN NOT NULL DEFAULT false,
    coach_name           TEXT,
    fetched_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (match_id, team_id)
);

CREATE TABLE lineup_players (
    id                  SERIAL PRIMARY KEY,
    lineup_id           INTEGER NOT NULL REFERENCES lineups(id) ON DELETE CASCADE,
    player_id           INTEGER NOT NULL, -- FK añadida en 003 tras crear players
    position            VARCHAR(10),
    shirt_number         INTEGER,
    is_starter           BOOLEAN NOT NULL DEFAULT true,
    grid_position        VARCHAR(10) -- ej. '4:2' fila:columna
);

CREATE INDEX idx_lineup_players_lineup ON lineup_players(lineup_id);
