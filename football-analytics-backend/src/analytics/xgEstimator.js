/**
 * Estimador de Goles Esperados (xG) por equipo a partir de sus últimos partidos.
 *
 * Modelo de fuerzas de ataque/defensa relativas a la media de la liga
 * (equivalente simplificado al modelo de Maher / Dixon-Coles):
 *
 *   fuerzaAtaqueLocal   = xGFor_promedio(local)      / xGPromedioLocalLiga
 *   fuerzaDefensaLocal  = xGAgainst_promedio(local)   / xGPromedioVisitaLiga
 *   fuerzaAtaqueVisita  = xGFor_promedio(visita)      / xGPromedioVisitaLiga
 *   fuerzaDefensaVisita = xGAgainst_promedio(visita)  / xGPromedioLocalLiga
 *
 *   xG_local  = fuerzaAtaqueLocal  * fuerzaDefensaVisita * xGPromedioLocalLiga
 *   xG_visita = fuerzaAtaqueVisita * fuerzaDefensaLocal  * xGPromedioVisitaLiga
 *
 * Todas las funciones son puras (no acceden a la base de datos) para que la
 * matemática sea trivialmente testeable; la capa de acceso a datos vive en
 * `src/repositories/analyticsRepository.js` y se combina en `predictMatch.js`.
 */

const MIN_TEAM_STRENGTH = 0.05; // evita fuerzas de 0 (equipo sin datos) que anularían el xG

/**
 * Calcula la tasa de goles/xG "combinada" de un equipo a partir de sus
 * últimos partidos. Se pondera el xG (más estable estadísticamente, menos
 * ruido) con los goles reales (lo que realmente determina resultados), y se
 * cae a solo-goles si no hay datos de xG disponibles (ej. liga sin stats avanzadas).
 *
 * `matches` es un array de { goalsFor, goalsAgainst, xgFor, xgAgainst } donde
 * xgFor/xgAgainst pueden ser null.
 */
function computeBlendedRates(matches, { xgWeight = 0.6 } = {}) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return { blendedGoalsFor: null, blendedGoalsAgainst: null, sampleSize: 0 };
  }

  const avg = (selector) => matches.reduce((sum, m) => sum + selector(m), 0) / matches.length;

  const avgGoalsFor = avg((m) => m.goalsFor);
  const avgGoalsAgainst = avg((m) => m.goalsAgainst);

  const withXg = matches.filter((m) => m.xgFor != null && m.xgAgainst != null);
  const hasXgData = withXg.length > 0;

  const avgXgFor = hasXgData ? withXg.reduce((s, m) => s + m.xgFor, 0) / withXg.length : null;
  const avgXgAgainst = hasXgData ? withXg.reduce((s, m) => s + m.xgAgainst, 0) / withXg.length : null;

  const effectiveXgWeight = hasXgData ? xgWeight : 0;

  return {
    blendedGoalsFor: effectiveXgWeight * avgXgFor + (1 - effectiveXgWeight) * avgGoalsFor,
    blendedGoalsAgainst: effectiveXgWeight * avgXgAgainst + (1 - effectiveXgWeight) * avgGoalsAgainst,
    sampleSize: matches.length,
  };
}

/**
 * Estima el xG esperado para un partido a partir de los últimos partidos de
 * cada equipo en su respectivo rol (el equipo local en sus partidos como
 * local, el visitante en sus partidos como visitante) y las medias de la liga.
 *
 * @param {object} params
 * @param {Array}  params.homeTeamHomeMatches - últimos partidos del local, jugando de local
 * @param {Array}  params.awayTeamAwayMatches  - últimos partidos del visitante, jugando de visita
 * @param {number} params.leagueAvgHomeGoals   - promedio de goles anotados por locales en la liga
 * @param {number} params.leagueAvgAwayGoals   - promedio de goles anotados por visitantes en la liga
 * @param {number} [params.xgWeight=0.6]       - peso del xG vs goles reales en la mezcla
 */
function estimateExpectedGoals({
  homeTeamHomeMatches,
  awayTeamAwayMatches,
  leagueAvgHomeGoals,
  leagueAvgAwayGoals,
  xgWeight = 0.6,
}) {
  if (leagueAvgHomeGoals <= 0 || leagueAvgAwayGoals <= 0) {
    throw new RangeError('League average goals must be > 0');
  }

  const home = computeBlendedRates(homeTeamHomeMatches, { xgWeight });
  const away = computeBlendedRates(awayTeamAwayMatches, { xgWeight });

  // Sin historial suficiente, se asume rendimiento promedio de liga (fuerza = 1).
  const homeAttackStrength = home.blendedGoalsFor != null
    ? Math.max(home.blendedGoalsFor / leagueAvgHomeGoals, MIN_TEAM_STRENGTH)
    : 1;
  const homeDefenseStrength = home.blendedGoalsAgainst != null
    ? Math.max(home.blendedGoalsAgainst / leagueAvgAwayGoals, MIN_TEAM_STRENGTH)
    : 1;
  const awayAttackStrength = away.blendedGoalsFor != null
    ? Math.max(away.blendedGoalsFor / leagueAvgAwayGoals, MIN_TEAM_STRENGTH)
    : 1;
  const awayDefenseStrength = away.blendedGoalsAgainst != null
    ? Math.max(away.blendedGoalsAgainst / leagueAvgHomeGoals, MIN_TEAM_STRENGTH)
    : 1;

  const homeXG = homeAttackStrength * awayDefenseStrength * leagueAvgHomeGoals;
  const awayXG = awayAttackStrength * homeDefenseStrength * leagueAvgAwayGoals;

  return {
    homeXG,
    awayXG,
    homeAttackStrength,
    homeDefenseStrength,
    awayAttackStrength,
    awayDefenseStrength,
    sampleSize: { home: home.sampleSize, away: away.sampleSize },
  };
}

module.exports = { computeBlendedRates, estimateExpectedGoals, MIN_TEAM_STRENGTH };
