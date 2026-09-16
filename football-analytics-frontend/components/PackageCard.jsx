import RiskBadge from './RiskBadge';

const MARKET_LABELS = {
  'double chance': 'Doble Oportunidad',
  'goals over/under': 'Más/Menos Goles',
  'both teams score': 'Ambos Anotan',
};

function marketLabel(market) {
  const normalized = (market || '').toLowerCase();
  for (const [key, label] of Object.entries(MARKET_LABELS)) {
    if (normalized.includes(key)) return label;
  }
  return market;
}

function formatKickoff(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function matchLabel(leg) {
  if (leg.homeTeamName && leg.awayTeamName) return `${leg.homeTeamName} vs. ${leg.awayTeamName}`;
  return `Partido #${leg.matchId}`;
}

/**
 * Tarjeta de paquete combinado (parlay de bajo riesgo o value bet), con
 * nivel de riesgo, cuotas consolidadas, probabilidad calculada, stake de
 * Kelly recomendado y la justificación algorítmica de cada leg.
 */
export default function PackageCard({ pkg, title = 'Paquete Combinado' }) {
  if (!pkg) return null;

  const probabilityPct = (pkg.cumulativeProbability * 100).toFixed(1);
  const kelly = pkg.kellyStake;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-white">{title}</h4>
          <p className="text-xs text-ink-muted">{pkg.legs.length} selecciones combinadas</p>
        </div>
        <RiskBadge level={pkg.riskLevel || 'low'} />
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Cuota Consolidada</p>
          <p className="font-mono text-lg font-semibold text-white">{pkg.combinedOdds.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Prob. Calculada</p>
          <p className="font-mono text-lg font-semibold text-neon-green">{probabilityPct}%</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Stake Kelly</p>
          <p className="font-mono text-lg font-semibold text-electric-blue">
            {kelly?.recommendedFraction ? `${(kelly.recommendedFraction * 100).toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {pkg.legs.map((leg, i) => (
          <li
            key={`${leg.matchId}-${i}`}
            className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-xs"
          >
            <div>
              <p className="font-medium text-slate-200">{matchLabel(leg)}</p>
              <p className="text-slate-500">
                {marketLabel(leg.market)} · {leg.selection} · {formatKickoff(leg.kickoffAt)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-slate-200">{leg.odds.toFixed(2)}</p>
              <p className="font-mono text-[11px] text-slate-500">{(leg.probability * 100).toFixed(0)}% prob.</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 rounded-lg border border-[#232b3e] bg-black/20 p-3 text-xs leading-relaxed text-ink-muted">
        <span className="font-semibold text-slate-300">Justificación algorítmica: </span>
        Cada selección proviene de un mercado de alta probabilidad (Doble Oportunidad, Más de 1.5 goles o
        Ambos Anotan) modelado con Poisson Bivariada a partir del xG reciente de cada equipo. La probabilidad
        acumulada del paquete ({probabilityPct}%) asume independencia entre partidos y supera el umbral de
        riesgo bajo (85%).
      </p>
    </div>
  );
}
