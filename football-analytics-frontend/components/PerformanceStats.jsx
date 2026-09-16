'use client';

import { AreaChart, Area, ResponsiveContainer } from 'recharts';

function StatTile({ label, value, accent = 'text-white', hint, children }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`stat-value mt-1 ${accent}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      {children}
    </div>
  );
}

function MiniSparkline({ data }) {
  if (!data || data.length <= 1) return null;
  return (
    <div className="mt-2 h-8 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00FF87" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#00FF87" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="bankroll" stroke="#00FF87" strokeWidth={1.5} fill="url(#sparklineGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Fila de KPIs de rendimiento. Se reutiliza en dos contextos:
 *  - Dashboard público: estadísticas globales del algoritmo (props por defecto).
 *  - Bankroll Tracker personal: pasa `recommendationsLabel`/`bankrollHint` para
 *    reflejar el bankroll inicial real del usuario en vez del texto genérico.
 */
export default function PerformanceStats({
  stats,
  recommendationsLabel = 'Recomendaciones',
  recommendationsHint = 'paquetes y value bets',
  bankrollHint,
}) {
  if (!stats) return null;

  const roiAccent = stats.roiPct >= 0 ? 'text-neon-green glow-text-green' : 'text-neon-magenta glow-text-magenta';
  const resolvedBankrollHint = bankrollHint ?? `simulado, base $${(stats.startingBankroll ?? 1000).toLocaleString()}`;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        label="Live ROI"
        value={`${stats.roiPct >= 0 ? '+' : ''}${stats.roiPct.toFixed(1)}%`}
        accent={roiAccent}
        hint={`sobre $${stats.totalStaked.toFixed(0)} apostados`}
      />
      <StatTile
        label="Win Rate (Low Risk)"
        value={`${stats.winRatePct.toFixed(1)}%`}
        accent="text-white"
        hint={`${stats.wins}W - ${stats.losses}L`}
      />
      <StatTile
        label={recommendationsLabel}
        value={stats.totalRecommendations}
        accent="text-electric-blue"
        hint={recommendationsHint}
      />
      <StatTile label="Bankroll" value={`$${stats.currentBankroll.toFixed(0)}`} accent="text-white" hint={resolvedBankrollHint}>
        <MiniSparkline data={stats.bankrollCurve} />
      </StatTile>
    </div>
  );
}
