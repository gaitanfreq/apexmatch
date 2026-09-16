-- ============================================================================
-- 003_players_and_availability.sql
-- Jugadores, lesiones, sanciones y disponibilidad para el partido.
-- ============================================================================

CREATE TABLE players (
    id                  SERIAL PRIMARY KEY,
    provider_player_id  INTEGER NOT NULL UNIQUE,
    name                TEXT NOT NULL,
    first_name          TEXT,
    last_name           TEXT,
    date_of_birth       DATE,
    nationality         TEXT,
    height_cm           INTEGER,
    weight_kg           INTEGER,
    primary_position    VARCHAR(20), -- Goalkeeper | Defender | Midfielder | Attacker
    current_team_id     INTEGER REFERENCES teams(id),
    photo_url           TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_players_team ON players(current_team_id);

ALTER TABLE lineup_players
    ADD CONSTRAINT fk_lineup_players_player
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

ALTER TABLE lineup_players
    ADD CONSTRAINT uq_lineup_players_lineup_player
    UNIQUE (lineup_id, player_id);

CREATE TABLE player_injuries (
    id                  SERIAL PRIMARY KEY,
    player_id           INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id              INTEGER REFERENCES teams(id),
    injury_type          TEXT,
    status               VARCHAR(20) NOT NULL DEFAULT 'out',
        -- out | doubtful | questionable | recovered
    reported_at           DATE,
    expected_return_date  DATE,
    actual_return_date     DATE,
    source                TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_player_injuries_player ON player_injuries(player_id);
CREATE INDEX idx_player_injuries_status ON player_injuries(status);

CREATE TABLE player_suspensions (
    id                  SERIAL PRIMARY KEY,
    player_id            INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id               INTEGER REFERENCES teams(id),
    reason                TEXT, -- ej. 'red_card', 'accumulated_yellow_cards', 'disciplinary'
    matches_banned         INTEGER,
    starts_match_id         INTEGER REFERENCES matches(id),
    ends_match_id           INTEGER REFERENCES matches(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_player_suspensions_player ON player_suspensions(player_id);

-- Disponibilidad calculada del jugador para un partido específico
-- (snapshot que la capa de features puede consumir directamente).
CREATE TABLE player_match_availability (
    id                  SERIAL PRIMARY KEY,
    match_id             INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id            INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id               INTEGER NOT NULL REFERENCES teams(id),
    availability          VARCHAR(20) NOT NULL DEFAULT 'available',
        -- available | injured | suspended | doubtful
    reason                 TEXT,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (match_id, player_id)
);

CREATE INDEX idx_player_match_availability_match ON player_match_availability(match_id);
