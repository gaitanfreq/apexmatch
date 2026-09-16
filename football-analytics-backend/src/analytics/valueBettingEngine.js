/**
 * Motor de Value Betting: compara nuestra probabilidad calculada (del modelo
 * de Poisson bivariada) contra la cuota decimal ofrecida por una casa de
 * apuestas, e identifica cuotas con "edge" (margen positivo) por encima de
 * un umbral (por defecto 5%).
 *
 * Definiciones:
 *   probabilidadImplícita = 1 / cuotaDecimal
 *   cuotaJusta            = 1 / nuestraProbabilidad
 *   edge                  = (nuestraProbabilidad * cuotaDecimal) - 1
 *
 * `edge` es el valor esperado por unidad apostada asumiendo que nuestra
 * probabilidad es correcta: edge=0.05 significa que, en promedio, cada 1
 * unidad apostada rinde 1.05 unidades a largo plazo (before variance).
 */

function calculateImpliedProbability(decimalOdds) {
  if (!(decimalOdds > 1)) throw new RangeError('decimalOdds must be > 1');
  return 1 / decimalOdds;
}

function calculateFairOdds(probability) {
  if (!(probability > 0 && probability <= 1)) throw new RangeError('probability must be in (0, 1]');
  return 1 / probability;
}

/** Overround (margen del bookmaker) de un conjunto de cuotas mutuamente excluyentes y exhaustivas. */
function calculateOverround(decimalOddsList) {
  return decimalOddsList.reduce((sum, odds) => sum + calculateImpliedProbability(odds), 0) - 1;
}

/** Edge (valor esperado por unidad) de apostar a `decimalOdds` si la probabilidad real es `probability`. */
function calculateEdge(probability, decimalOdds) {
  if (!(probability >= 0 && probability <= 1)) throw new RangeError('probability must be in [0, 1]');
  if (!(decimalOdds > 1)) throw new RangeError('decimalOdds must be > 1');
  return probability * decimalOdds - 1;
}

/**
 * Traduce mercado/selección de la casa de apuestas (tal como se almacena en
 * `odds_markets`/`odds_snapshots`, ver migración 004) a la probabilidad
 * correspondiente calculada por el modelo (ver `poissonModel.aggregateMarketProbabilities`).
 * Devuelve null si el mercado no está soportado por el modelo actual.
 */
function resolveModelProbability(marketProbabilities, marketName, selection, handicap) {
  const market = (marketName || '').toLowerCase();
  const sel = (selection || '').trim().toLowerCase();

  if (market.includes('match winner') || market === '1x2') {
    if (sel === 'home') return marketProbabilities.homeWin;
    if (sel === 'draw') return marketProbabilities.draw;
    if (sel === 'away') return marketProbabilities.awayWin;
    return null;
  }

  if (market.includes('double chance')) {
    if (sel === 'home/draw' || sel === '1x') return marketProbabilities.doubleChance.homeOrDraw;
    if (sel === 'draw/away' || sel === 'x2') return marketProbabilities.doubleChance.awayOrDraw;
    if (sel === 'home/away' || sel === '12') return marketProbabilities.doubleChance.homeOrAway;
    return null;
  }

  if (market.includes('over/under') || market.includes('goals over')) {
    if (handicap == null) return null;
    const bucket = marketProbabilities.overUnder[String(handicap)];
    if (!bucket) return null;
    if (sel.startsWith('over')) return bucket.over;
    if (sel.startsWith('under')) return bucket.under;
    return null;
  }

  if (market.includes('both teams score')) {
    if (sel === 'yes') return marketProbabilities.btts.yes;
    if (sel === 'no') return marketProbabilities.btts.no;
    return null;
  }

  return null;
}

/**
 * Analiza una lista de cuotas de mercado contra las probabilidades del
 * modelo para un partido y devuelve las que superan el umbral de edge.
 *
 * @param {object} marketProbabilities - salida de poissonModel.aggregateMarketProbabilities
 * @param {Array}  marketOdds - [{ market, selection, handicap, bookmaker, oddsDecimal }, ...]
 * @param {object} [options]
 * @param {number} [options.minEdge=0.05] - umbral mínimo de edge (5%)
 * @param {number} [options.maxEdge=0.20] - tope superior de edge (20%): por encima de
 *   esto, en la práctica siempre es ruido/error de cálculo, no una oportunidad real
 *   (ver config.api.maxEdge) — se descarta en vez de mostrarse como value bet.
 */
function findValueBets(marketProbabilities, marketOdds, { minEdge = 0.05, maxEdge = 0.2 } = {}) {
  const results = [];

  for (const quote of marketOdds) {
    const probability = resolveModelProbability(
      marketProbabilities,
      quote.market,
      quote.selection,
      quote.handicap
    );

    if (probability == null || probability <= 0) continue;

    const edge = calculateEdge(probability, quote.oddsDecimal);
    if (edge >= minEdge && edge <= maxEdge) {
      results.push({
        ...quote,
        ourProbability: probability,
        impliedProbability: calculateImpliedProbability(quote.oddsDecimal),
        fairOdds: calculateFairOdds(probability),
        edge,
      });
    }
  }

  return results.sort((a, b) => b.edge - a.edge);
}

module.exports = {
  calculateImpliedProbability,
  calculateFairOdds,
  calculateOverround,
  calculateEdge,
  resolveModelProbability,
  findValueBets,
};
