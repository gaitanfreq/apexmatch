/**
 * Agregación de métricas de rendimiento histórico (ROI, % de aciertos, curva
 * de bankroll) a partir del registro de recomendaciones ya resueltas.
 * Función pura: recibe el historial ya resuelto y no toca la base de datos
 * (ver `src/repositories/statsRepository.js` para la fuente de datos real).
 */

/**
 * @param {Array} settledHistory - [{ stakeAmount, profitLoss, status, recommendedAt }, ...]
 *   ordenado cronológicamente ascendente.
 * @param {number} [startingBankroll=1000]
 */
function computePerformanceStats(settledHistory, { startingBankroll = 1000 } = {}) {
  if (!Array.isArray(settledHistory) || settledHistory.length === 0) {
    return {
      totalRecommendations: 0,
      wins: 0,
      losses: 0,
      winRatePct: 0,
      totalStaked: 0,
      totalProfitLoss: 0,
      roiPct: 0,
      currentBankroll: startingBankroll,
      bankrollCurve: [{ date: null, bankroll: startingBankroll }],
    };
  }

  let bankroll = startingBankroll;
  let wins = 0;
  let losses = 0;
  let totalStaked = 0;
  let totalProfitLoss = 0;

  const bankrollCurve = [{ date: null, bankroll }];

  for (const record of settledHistory) {
    const stake = Number(record.stakeAmount) || 0;
    const pnl = Number(record.profitLoss) || 0;

    if (record.status === 'won') wins += 1;
    if (record.status === 'lost') losses += 1;

    totalStaked += stake;
    totalProfitLoss += pnl;
    bankroll += pnl;

    bankrollCurve.push({ date: record.settledAt ?? record.recommendedAt ?? null, bankroll });
  }

  const decided = wins + losses;
  const winRatePct = decided > 0 ? (wins / decided) * 100 : 0;
  const roiPct = totalStaked > 0 ? (totalProfitLoss / totalStaked) * 100 : 0;

  return {
    totalRecommendations: settledHistory.length,
    wins,
    losses,
    winRatePct,
    totalStaked,
    totalProfitLoss,
    roiPct,
    currentBankroll: bankroll,
    bankrollCurve,
  };
}

module.exports = { computePerformanceStats };
