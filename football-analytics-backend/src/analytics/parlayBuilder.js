/**
 * Generador de Paquetes (combinadas/parlays) de Bajo Riesgo.
 *
 * Combina "legs" (una selección de mercado para un partido, con nuestra
 * probabilidad calculada y la cuota del bookmaker) de mercados de alta
 * probabilidad — Doble Oportunidad, Más de 1.5 goles, Ambos Anotan — en
 * paquetes cuya probabilidad acumulada proyectada (asumiendo independencia
 * entre partidos) sea mayor a un umbral (85% por defecto).
 *
 * Supuesto clave: las legs deben venir de partidos DISTINTOS. Multiplicar
 * probabilidades de dos mercados del mismo partido violaría el supuesto de
 * independencia (ej. "Over 1.5" y "BTTS Yes" del mismo partido están
 * correlacionados), así que el algoritmo se queda con la mejor leg por
 * partido antes de combinar.
 */

const DEFAULT_ALLOWED_MARKETS = ['double chance', 'goals over/under', 'both teams score'];

function isAllowedMarket(marketName, allowedMarkets) {
  const normalized = (marketName || '').toLowerCase();
  return allowedMarkets.some((allowed) => normalized.includes(allowed));
}

/**
 * Filtra candidatos a mercados permitidos y probabilidad individual mínima,
 * y deduplica quedándose con la mejor leg (mayor probabilidad) por partido.
 */
function selectBestLegPerMatch(candidates, { minLegProbability = 0.6, allowedMarkets = DEFAULT_ALLOWED_MARKETS } = {}) {
  const eligible = candidates.filter(
    (leg) => isAllowedMarket(leg.market, allowedMarkets) && leg.probability >= minLegProbability && leg.odds > 1
  );

  const bestPerMatch = new Map();
  for (const leg of eligible) {
    const current = bestPerMatch.get(leg.matchId);
    if (!current || leg.probability > current.probability) {
      bestPerMatch.set(leg.matchId, leg);
    }
  }

  return [...bestPerMatch.values()].sort((a, b) => b.probability - a.probability);
}

function combineLegs(legs) {
  return {
    legs,
    cumulativeProbability: legs.reduce((p, leg) => p * leg.probability, 1),
    combinedOdds: legs.reduce((o, leg) => o * leg.odds, 1),
  };
}

/**
 * Estrategia greedy: agrega legs en orden descendente de probabilidad
 * mientras la probabilidad acumulada se mantenga por encima del umbral.
 * Como multiplicar probabilidades independientes en (0,1) siempre reduce el
 * acumulado, agregar en orden descendente maximiza cuántas legs (y por lo
 * tanto el payout) se pueden incluir sin cruzar el umbral de riesgo.
 */
function buildGreedyParlay(sortedLegs, { minCumulativeProbability = 0.85, maxLegs = 6, minLegs = 2 } = {}) {
  const selected = [];
  let cumulativeProbability = 1;

  for (const leg of sortedLegs) {
    if (selected.length >= maxLegs) break;
    const candidateCumulative = cumulativeProbability * leg.probability;
    if (candidateCumulative >= minCumulativeProbability) {
      selected.push(leg);
      cumulativeProbability = candidateCumulative;
    }
    // Si agregar esta leg rompe el umbral, se descarta y se sigue probando
    // con la siguiente (más legs disponibles podrían no ser necesarios,
    // pero una leg puntual de menor probabilidad relativa no debe bloquear
    // el resto del pool).
  }

  if (selected.length < minLegs) return null;
  return combineLegs(selected);
}

/**
 * Explora combinaciones (tamaño minLegs..maxLegs) sobre el top-K de
 * candidatos por probabilidad, para ofrecer varias alternativas de paquete
 * que cumplen el umbral, rankeadas por mejor payout (cuota combinada).
 * El espacio de búsqueda se acota a `candidatePoolSize` legs para mantener
 * el número de combinaciones manejable (por defecto <=10 -> <=968 combos).
 */
function* combinations(items, size, start = 0, prefix = []) {
  if (prefix.length === size) {
    yield prefix;
    return;
  }
  for (let i = start; i < items.length; i += 1) {
    yield* combinations(items, size, i + 1, [...prefix, items[i]]);
  }
}

function buildRankedParlays(sortedLegs, {
  minCumulativeProbability = 0.85,
  maxLegs = 6,
  minLegs = 2,
  candidatePoolSize = 10,
  maxResults = 5,
} = {}) {
  const pool = sortedLegs.slice(0, candidatePoolSize);
  const valid = [];

  for (let size = minLegs; size <= Math.min(maxLegs, pool.length); size += 1) {
    for (const combo of combinations(pool, size)) {
      const packageResult = combineLegs(combo);
      if (packageResult.cumulativeProbability >= minCumulativeProbability) {
        valid.push(packageResult);
      }
    }
  }

  valid.sort((a, b) => b.combinedOdds - a.combinedOdds);
  return valid.slice(0, maxResults);
}

/**
 * API principal: dado un pool de candidatos (legs de distintos partidos y
 * mercados), devuelve el mejor paquete greedy y una lista rankeada de
 * paquetes alternativos, todos con probabilidad acumulada > umbral.
 *
 * @param {Array} candidates - [{ matchId, market, selection, probability, odds }, ...]
 * @param {object} [options]
 * @param {number} [options.minLegProbability=0.6]      - probabilidad mínima por leg individual
 * @param {number} [options.minCumulativeProbability=0.85] - umbral de probabilidad acumulada del paquete
 * @param {number} [options.maxLegs=6]
 * @param {number} [options.minLegs=2]
 * @param {string[]} [options.allowedMarkets]            - mercados de alta probabilidad permitidos
 */
function buildLowRiskParlays(candidates, options = {}) {
  const {
    minLegProbability = 0.6,
    minCumulativeProbability = 0.85,
    maxLegs = 6,
    minLegs = 2,
    allowedMarkets = DEFAULT_ALLOWED_MARKETS,
    candidatePoolSize = 10,
    maxResults = 5,
  } = options;

  const sortedLegs = selectBestLegPerMatch(candidates, { minLegProbability, allowedMarkets });

  const bestParlay = buildGreedyParlay(sortedLegs, { minCumulativeProbability, maxLegs, minLegs });
  const rankedAlternatives = buildRankedParlays(sortedLegs, {
    minCumulativeProbability,
    maxLegs,
    minLegs,
    candidatePoolSize,
    maxResults,
  });

  return {
    eligibleLegCount: sortedLegs.length,
    bestParlay,
    alternatives: rankedAlternatives,
  };
}

module.exports = {
  selectBestLegPerMatch,
  combineLegs,
  buildGreedyParlay,
  buildRankedParlays,
  buildLowRiskParlays,
  DEFAULT_ALLOWED_MARKETS,
};
