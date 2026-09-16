/**
 * Gestor de Bankroll con Criterio de Kelly.
 *
 * Kelly clásico:  f* = (b*p - q) / b
 *   donde b = cuotaDecimal - 1 (ganancia neta por unidad apostada)
 *         p = probabilidad de ganar (nuestra probabilidad, no la implícita)
 *         q = 1 - p
 *
 * f* es la fracción del bankroll que maximiza el crecimiento logarítmico
 * esperado a largo plazo. En la práctica se usa una fracción de Kelly
 * (25%-50%) porque el Kelly completo asume probabilidades exactas —
 * cualquier error de estimación se penaliza fuertemente con varianza real,
 * y el "half/quarter Kelly" reduce drásticamente esa varianza a cambio de
 * un crecimiento esperado solo moderadamente menor.
 */

const DEFAULT_KELLY_MULTIPLIER = 0.25;
const DEFAULT_MAX_STAKE_FRACTION = 0.05; // tope duro por apuesta individual, independiente de Kelly

/** Fracción de Kelly completa (sin fraccionar). Negativa o cero si no hay edge. */
function calculateFullKellyFraction(probability, decimalOdds) {
  if (!(probability > 0 && probability <= 1)) throw new RangeError('probability must be in (0, 1]');
  if (!(decimalOdds > 1)) throw new RangeError('decimalOdds must be > 1');

  const b = decimalOdds - 1;
  const q = 1 - probability;
  const fullKelly = (b * probability - q) / b;
  return fullKelly;
}

/**
 * Calcula el stake recomendado para una apuesta individual (o un paquete
 * tratado como una sola apuesta, ver `parlayBuilder.js`), usando Kelly
 * fraccionado y un tope máximo de exposición por apuesta.
 *
 * @param {object} params
 * @param {number} params.probability      - nuestra probabilidad de que la apuesta gane
 * @param {number} params.decimalOdds      - cuota decimal ofrecida
 * @param {number} params.bankroll         - bankroll total disponible
 * @param {number} [params.kellyMultiplier=0.25] - fracción de Kelly a aplicar (0.25 o 0.5 recomendado)
 * @param {number} [params.maxStakeFraction=0.05] - tope duro de % de bankroll por apuesta
 */
function calculateRecommendedStake({
  probability,
  decimalOdds,
  bankroll,
  kellyMultiplier = DEFAULT_KELLY_MULTIPLIER,
  maxStakeFraction = DEFAULT_MAX_STAKE_FRACTION,
}) {
  if (!(bankroll > 0)) throw new RangeError('bankroll must be > 0');
  if (!(kellyMultiplier > 0 && kellyMultiplier <= 1)) {
    throw new RangeError('kellyMultiplier must be in (0, 1]');
  }

  const fullKellyFraction = calculateFullKellyFraction(probability, decimalOdds);
  const edge = probability * decimalOdds - 1;

  if (fullKellyFraction <= 0) {
    return {
      fullKellyFraction,
      recommendedFraction: 0,
      recommendedStake: 0,
      edge,
      recommendation: 'no_bet',
      reason: 'No hay edge positivo: la cuota no compensa nuestra probabilidad estimada.',
    };
  }

  const fractionalKelly = fullKellyFraction * kellyMultiplier;
  const recommendedFraction = Math.min(fractionalKelly, maxStakeFraction);

  return {
    fullKellyFraction,
    recommendedFraction,
    recommendedStake: recommendedFraction * bankroll,
    edge,
    recommendation: 'bet',
    cappedByMaxStake: fractionalKelly > maxStakeFraction,
  };
}

/**
 * Distribuye el bankroll entre múltiples apuestas/paquetes simultáneos
 * (ej. varios parlays de la misma jornada). Calcula el stake de Kelly
 * fraccionado para cada uno de forma independiente y, si la exposición total
 * supera `maxTotalExposureFraction` del bankroll, escala proporcionalmente
 * todos los stakes hacia abajo (control de riesgo de correlación /
 * sobreexposición simultánea, ya que Kelly individual asume que es la única
 * apuesta activa).
 *
 * @param {Array} bets - [{ id, probability, decimalOdds }, ...]
 * @param {object} params
 * @param {number} params.bankroll
 * @param {number} [params.kellyMultiplier=0.25]
 * @param {number} [params.maxStakeFraction=0.05]      - tope individual
 * @param {number} [params.maxTotalExposureFraction=0.2] - tope agregado simultáneo
 */
function recommendBankrollAllocation(bets, {
  bankroll,
  kellyMultiplier = DEFAULT_KELLY_MULTIPLIER,
  maxStakeFraction = DEFAULT_MAX_STAKE_FRACTION,
  maxTotalExposureFraction = 0.2,
} = {}) {
  const individual = bets.map((bet) => ({
    ...bet,
    ...calculateRecommendedStake({
      probability: bet.probability,
      decimalOdds: bet.decimalOdds,
      bankroll,
      kellyMultiplier,
      maxStakeFraction,
    }),
  }));

  const totalFraction = individual.reduce((sum, b) => sum + b.recommendedFraction, 0);
  const maxAllowed = maxTotalExposureFraction;

  if (totalFraction <= maxAllowed || totalFraction === 0) {
    return { bets: individual, totalStakeFraction: totalFraction, scaledDown: false };
  }

  const scale = maxAllowed / totalFraction;
  const scaled = individual.map((b) => ({
    ...b,
    recommendedFraction: b.recommendedFraction * scale,
    recommendedStake: b.recommendedFraction * scale * bankroll,
  }));

  return { bets: scaled, totalStakeFraction: maxAllowed, scaledDown: true };
}

module.exports = {
  calculateFullKellyFraction,
  calculateRecommendedStake,
  recommendBankrollAllocation,
  DEFAULT_KELLY_MULTIPLIER,
  DEFAULT_MAX_STAKE_FRACTION,
};
