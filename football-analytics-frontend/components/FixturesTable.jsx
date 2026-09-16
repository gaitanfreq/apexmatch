'use client';

import { useI18n } from './i18n/LanguageProvider';
import { formatKickoff } from '@/lib/formatDate';

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
 * de resultado como badges — usada en el Dashboard (resumen) y en Live Predictions (completa).
 */
export default function FixturesTable({ predictions = [], limit }) {
  const { t, locale } = useI18n();
  const rows = limit ? predictions.slice(0, limit) : predictions;

  if (rows.length === 0) {
    return <div className="card p-6 text-center text-sm text-ink-muted">{t('match.noFixtures')}</div>;
  }

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#232b3e] text-left text-[11px] uppercase tracking-wide text-ink-muted">
            <th className="px-4 py-3 font-medium">{t('match.fixture')}</th>
            <th className="px-4 py-3 font-medium">{t('match.xg')} ({t('match.homeShort')} · {t('match.awayShort')})</th>
            <th className="px-4 py-3 font-medium">{t('match.resultLabel')}</th>
            <th className="px-4 py-3 font-medium">{t('match.keyMarkets')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const homeName = p.fixture.homeTeamName ?? t('match.team', { id: p.fixture.homeTeamId });
            const awayName = p.fixture.awayTeamName ?? t('match.team', { id: p.fixture.awayTeamId });
            const over15 = p.markets.overUnder?.['1.5'];
            const btts = p.markets.btts;

            return (
              <tr key={p.fixture.id} className="border-b border-[#232b3e]/60 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{homeName} vs. {awayName}</p>
                  <p className="text-xs text-ink-muted">{formatKickoff(p.fixture.kickoffAt, locale)}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-electric-blue">{p.expectedGoals.home.toFixed(2)}</span>
                  <span className="mx-1 text-ink-muted">vs</span>
                  <span className="font-mono text-electric-blue">{p.expectedGoals.away.toFixed(2)}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <OutcomeBadge label={t('match.homeWinLabel', { team: homeName })} probability={p.markets.homeWin} tone="green" />
                    <OutcomeBadge label={t('match.drawLabel')} probability={p.markets.draw} tone="muted" />
                    <OutcomeBadge label={t('match.awayWinLabel', { team: awayName })} probability={p.markets.awayWin} tone="blue" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {over15 && <OutcomeBadge label={t('match.over15')} probability={over15.over} tone="green" />}
                    {btts && <OutcomeBadge label={t('match.btts')} probability={btts.yes} tone="blue" />}
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
