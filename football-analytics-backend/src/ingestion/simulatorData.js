/**
 * Datos y matemática pura del simulador de partidos (sin tocar la base de
 * datos — ver `matchSimulator.js` para la orquestación). Sirve como fuente
 * automatizada de partidos cuando no hay una API_FOOTBALL_KEY real
 * (MATCH_DATA_SOURCE=simulator, ver src/config/index.js).
 *
 * Usa nombres de clubes reales para que el módulo de Ligas/Competiciones
 * (Champions League, La Liga, Premier League, Serie A) se vea genuino, con
 * un rating simple de ataque/defensa por club para generar marcadores
 * plausibles (los clubes grandes ganan más seguido, pero no siempre).
 */

// IDs consistentes con la convención de API-Football (ver .env.example de la Fase 1).
const LEAGUES = {
  CHAMPIONS_LEAGUE: { providerLeagueId: 2, name: 'UEFA Champions League', countryName: 'Europa' },
  PREMIER_LEAGUE: { providerLeagueId: 39, name: 'Premier League', countryName: 'Inglaterra' },
  LA_LIGA: { providerLeagueId: 140, name: 'La Liga', countryName: 'España' },
  SERIE_A: { providerLeagueId: 135, name: 'Serie A', countryName: 'Italia' },
};

// attack/defense: fuerza relativa a un club promedio (1.0). defense > 1 = concede más de lo normal.
const CLUB_RATINGS = {
  'Real Madrid': { providerTeamId: 700101, attack: 2.1, defense: 0.85 },
  Barcelona: { providerTeamId: 700102, attack: 2.0, defense: 0.95 },
  'Atlético Madrid': { providerTeamId: 700103, attack: 1.5, defense: 0.75 },
  Sevilla: { providerTeamId: 700104, attack: 1.3, defense: 1.1 },
  'Real Sociedad': { providerTeamId: 700105, attack: 1.4, defense: 1.0 },
  'Athletic Club': { providerTeamId: 700106, attack: 1.35, defense: 1.0 },
  'Manchester City': { providerTeamId: 700107, attack: 2.2, defense: 0.8 },
  Liverpool: { providerTeamId: 700108, attack: 2.0, defense: 0.9 },
  Arsenal: { providerTeamId: 700109, attack: 1.9, defense: 0.85 },
  Chelsea: { providerTeamId: 700110, attack: 1.6, defense: 1.0 },
  'Manchester United': { providerTeamId: 700111, attack: 1.5, defense: 1.05 },
  'Tottenham Hotspur': { providerTeamId: 700112, attack: 1.7, defense: 1.1 },
  'Bayern Munich': { providerTeamId: 700113, attack: 2.3, defense: 0.8 },
  'Paris Saint-Germain': { providerTeamId: 700114, attack: 2.1, defense: 0.95 },
  'Inter Milan': { providerTeamId: 700115, attack: 1.8, defense: 0.85 },
  'AC Milan': { providerTeamId: 700116, attack: 1.6, defense: 0.95 },
  Juventus: { providerTeamId: 700117, attack: 1.5, defense: 0.8 },
  Napoli: { providerTeamId: 700118, attack: 1.7, defense: 0.9 },
  'AS Roma': { providerTeamId: 700119, attack: 1.5, defense: 1.0 },
  Atalanta: { providerTeamId: 700120, attack: 1.6, defense: 1.05 },
};

const LEAGUE_ROSTERS = {
  CHAMPIONS_LEAGUE: ['Real Madrid', 'Manchester City', 'Bayern Munich', 'Paris Saint-Germain', 'Liverpool', 'Inter Milan'],
  PREMIER_LEAGUE: ['Manchester City', 'Liverpool', 'Arsenal', 'Chelsea', 'Manchester United', 'Tottenham Hotspur'],
  LA_LIGA: ['Real Madrid', 'Barcelona', 'Atlético Madrid', 'Sevilla', 'Real Sociedad', 'Athletic Club'],
  SERIE_A: ['Inter Milan', 'AC Milan', 'Juventus', 'Napoli', 'AS Roma', 'Atalanta'],
};

const HOME_ADVANTAGE = 1.1;
const AWAY_DISADVANTAGE = 0.92;

/** xG esperado de local/visitante a partir de sus ratings de ataque/defensa. */
function computeMatchXG(homeTeamName, awayTeamName) {
  const home = CLUB_RATINGS[homeTeamName];
  const away = CLUB_RATINGS[awayTeamName];
  if (!home || !away) {
    throw new RangeError(`Club sin rating: ${!home ? homeTeamName : awayTeamName}`);
  }

  return {
    homeXG: Number((home.attack * away.defense * HOME_ADVANTAGE).toFixed(2)),
    awayXG: Number((away.attack * home.defense * AWAY_DISADVANTAGE).toFixed(2)),
  };
}

/** Muestra un entero Poisson(lambda) — algoritmo de Knuth. Usado para simular el marcador final. */
function samplePoisson(lambda) {
  if (lambda <= 0) return 0;
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= Math.random();
  } while (p > limit);
  return k - 1;
}

module.exports = {
  LEAGUES,
  CLUB_RATINGS,
  LEAGUE_ROSTERS,
  computeMatchXG,
  samplePoisson,
};
