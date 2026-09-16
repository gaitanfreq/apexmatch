function formatKickoff(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function OutcomeBadge({ label, probability, tone }) {
  const toneClass = {
    green: 'bg-neon-green/15 text-neon-green',
    blue: 'bg-electric-blue/15 text-electric-blue',
    muted: 'bg-white/5 text-ink-muted',
  }[tone];

  return (
    <span className={`badge ${toneClass}`}>
      {label} <span className="font-mono">{(probability * 100).toFixed(0)}%</span>
    </span>
  );
}

/**
 * Tabla oscura de partidos con xG estimado (azul eléctrico) y probabilidades
 * 1X2 como badges — usada en el Dashboard (resumen) y en Live Predictions (completa).
 */
export default function FixturesTable({ predictions = [], limit }) {
  const rows = limit ? predictions.slice(0, limit) : predictions;

  if (rows.length === 0) {
    return <div className="card p-6 text-center text-sm text-ink-muted">No hay fixtures próximos en este momento.</div>;
  }

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#232b3e] text-left text-[11px] uppercase tracking-wide text-ink-muted">
            <th className="px-4 py-3 font-medium">Fixture</th>
            <th className="px-4 py-3 font-medium">xG (Local · Visita)</th>
            <th className="px-4 py-3 font-medium">1X2</th>
            <th className="px-4 py-3 font-medium">Mercados Clave</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const homeName = p.fixture.homeTeamName ?? `Equipo #${p.fixture.homeTeamId}`;
            const awayName = p.fixture.awayTeamName ?? `Equipo #${p.fixture.awayTeamId}`;
            const over15 = p.markets.overUnder?.['1.5'];
            const btts = p.markets.btts;

            return (
              <tr key={p.fixture.id} className="border-b border-[#232b3e]/60 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{homeName} vs. {awayName}</p>
                  <p className="text-xs text-ink-muted">{formatKickoff(p.fixture.kickoffAt)}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-electric-blue">{p.expectedGoals.home.toFixed(2)}</span>
                  <span className="mx-1 text-ink-muted">vs</span>
                  <span className="font-mono text-electric-blue">{p.expectedGoals.away.toFixed(2)}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <OutcomeBadge label="1" probability={p.markets.homeWin} tone="green" />
                    <OutcomeBadge label="X" probability={p.markets.draw} tone="muted" />
                    <OutcomeBadge label="2" probability={p.markets.awayWin} tone="blue" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {over15 && <OutcomeBadge label="Over 1.5" probability={over15.over} tone="green" />}
                    {btts && <OutcomeBadge label="BTTS" probability={btts.yes} tone="blue" />}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
