import Link from 'next/link';
import MatchStatusBadge from './MatchStatusBadge';

function formatKickoff(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function OutcomeBadge({ label, probability, tone }) {
  const toneClass = { green: 'bg-neon-green/15 text-neon-green', blue: 'bg-electric-blue/15 text-electric-blue', muted: 'bg-white/5 text-ink-muted' }[tone];
  return (
    <span className={`badge ${toneClass}`}>
      {label} <span className="font-mono">{(probability * 100).toFixed(0)}%</span>
    </span>
  );
}

/** Sección "Value Bet potential" — teaser bloqueado para no-VIP, edge real para VIP/admin. */
function ValueBetSection({ valueBet }) {
  if (!valueBet) return null;

  if (!valueBet.hasValue) {
    return <p className="mt-3 text-xs text-ink-muted">Sin value bet detectado en este partido por ahora.</p>;
  }

  if (valueBet.locked) {
    return (
      <div className="mt-3 flex items-center justify-between rounded-lg border border-neon-magenta/30 bg-neon-magenta/10 px-3 py-2">
        <span className="text-xs font-medium text-neon-magenta">🔒 Value Bet potencial detectado</span>
        <Link href="/vip" className="text-xs font-semibold text-neon-magenta underline underline-offset-2">
          Desbloquear
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center justify-between rounded-lg border border-neon-green/30 bg-neon-green/10 px-3 py-2">
      <span className="text-xs font-medium text-neon-green">Value Bet detectado</span>
      <span className="font-mono text-xs font-semibold text-neon-green">Edge +{(valueBet.edge * 100).toFixed(1)}%</span>
    </div>
  );
}

/** Tarjeta de partido: liga + estado, equipos, xG/1X2 (si aplica) y análisis de valor. */
export default function MatchCard({ prediction }) {
  const { fixture, expectedGoals, markets, valueBet } = prediction;
  const isScheduled = fixture.status === 'scheduled';
  const hasScore = fixture.homeGoals != null && fixture.awayGoals != null;

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="badge bg-white/5 text-ink-muted">{fixture.leagueName}</span>
        <MatchStatusBadge status={fixture.status} />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-medium text-white">
            {fixture.homeTeamName} <span className="text-ink-muted">vs.</span> {fixture.awayTeamName}
          </p>
          <p className="text-xs text-ink-muted">
            {isScheduled ? formatKickoff(fixture.kickoffAt) : fixture.statusDetail || formatKickoff(fixture.kickoffAt)}
          </p>
        </div>
        {hasScore && (
          <p className="font-mono text-xl font-bold text-white">
            {fixture.homeGoals} - {fixture.awayGoals}
          </p>
        )}
      </div>

      {isScheduled && expectedGoals && (
        <>
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className="text-ink-muted">xG:</span>
            <span className="font-mono text-electric-blue">{expectedGoals.home.toFixed(2)}</span>
            <span className="text-ink-muted">vs</span>
            <span className="font-mono text-electric-blue">{expectedGoals.away.toFixed(2)}</span>
          </div>
          {markets && (
            <div className="flex flex-wrap gap-1.5">
              <OutcomeBadge label="1" probability={markets.homeWin} tone="green" />
              <OutcomeBadge label="X" probability={markets.draw} tone="muted" />
              <OutcomeBadge label="2" probability={markets.awayWin} tone="blue" />
            </div>
          )}
          <ValueBetSection valueBet={valueBet} />
        </>
      )}
    </div>
  );
}
