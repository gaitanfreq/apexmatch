function formatKickoff(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function matchLabel(bet) {
  if (bet.homeTeamName && bet.awayTeamName) return `${bet.homeTeamName} vs. ${bet.awayTeamName}`;
  return `Partido #${bet.matchId}`;
}

/** Tarjeta de Value Bet — edge sobre la cuota del bookmaker. Contenido VIP (magenta neón). */
export default function ValueBetCard({ bet }) {
  const edgePct = (bet.edge * 100).toFixed(1);
  const ourProbPct = (bet.ourProbability * 100).toFixed(1);
  const impliedProbPct = (bet.impliedProbability * 100).toFixed(1);

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-ink-muted">{formatKickoff(bet.kickoffAt)} · {matchLabel(bet)}</p>
          <h4 className="text-sm font-semibold text-white">
            {bet.market} <span className="text-neon-magenta">— {bet.selection}</span>
          </h4>
          <p className="text-xs text-ink-muted">Casa: {bet.bookmaker}</p>
        </div>
        <span className="badge bg-neon-magenta/15 text-neon-magenta glow-text-magenta">Edge +{edgePct}%</span>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-ink-muted">Cuota</p>
          <p className="font-mono text-base font-semibold text-white">{bet.oddsDecimal.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-ink-muted">Cuota Justa</p>
          <p className="font-mono text-base font-semibold text-slate-300">{bet.fairOdds.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-ink-muted">Nuestra Prob.</p>
          <p className="font-mono text-base font-semibold text-electric-blue">{ourProbPct}%</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-ink-muted">Prob. Implícita</p>
          <p className="font-mono text-base font-semibold text-slate-400">{impliedProbPct}%</p>
        </div>
      </div>

      {bet.kellyStake && (
        <div className="flex items-center justify-between rounded-lg border border-neon-magenta/30 bg-neon-magenta/10 px-3 py-2 text-xs">
          <span className="text-slate-300">Stake recomendado (Kelly fraccionado)</span>
          <span className="font-mono font-semibold text-neon-magenta">
            {bet.kellyStake.recommendedFraction > 0
              ? `${(bet.kellyStake.recommendedFraction * 100).toFixed(2)}% del bankroll ($${bet.kellyStake.recommendedStake.toFixed(2)})`
              : 'No apostar'}
          </span>
        </div>
      )}
    </div>
  );
}
