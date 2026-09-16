'use client';

import RiskBadge from './RiskBadge';
import { useI18n } from './i18n/LanguageProvider';
import { formatKickoff } from '@/lib/formatDate';

const MARKET_KEYS = {
  'double chance': 'packageCard.doubleChance',
  'goals over/under': 'packageCard.goalsOverUnder',
  'both teams score': 'packageCard.bothTeamsScore',
};

function marketLabel(market, t) {
  const normalized = (market || '').toLowerCase();
  for (const [key, tKey] of Object.entries(MARKET_KEYS)) {
    if (normalized.includes(key)) return t(tKey);
  }
  return market;
}

function matchLabel(leg, t) {
  if (leg.homeTeamName && leg.awayTeamName) return `${leg.homeTeamName} vs. ${leg.awayTeamName}`;
  return t('match.match', { id: leg.matchId });
}

/**
 * Tarjeta de paquete combinado (parlay de bajo riesgo o value bet), con
 * nivel de riesgo, cuotas consolidadas, probabilidad calculada, stake de
 * Kelly recomendado y la justificación algorítmica de cada leg.
 */
export default function PackageCard({ pkg, title }) {
  const { t, locale } = useI18n();
  if (!pkg) return null;

  const probabilityPct = (pkg.cumulativeProbability * 100).toFixed(1);
  const kelly = pkg.kellyStake;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-white">{title ?? t('packageCard.defaultTitle')}</h4>
          <p className="text-xs text-ink-muted">{t('packageCard.selectionsCount', { count: pkg.legs.length })}</p>
        </div>
        <RiskBadge level={pkg.riskLevel || 'low'} />
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">{t('packageCard.consolidatedOdds')}</p>
          <p className="font-mono text-lg font-semibold text-white">{pkg.combinedOdds.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">{t('packageCard.calculatedProb')}</p>
          <p className="font-mono text-lg font-semibold text-neon-green">{probabilityPct}%</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">{t('packageCard.kellyStake')}</p>
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
              <p className="font-medium text-slate-200">{matchLabel(leg, t)}</p>
              <p className="text-slate-500">
                {marketLabel(leg.market, t)} · {leg.selection} · {formatKickoff(leg.kickoffAt, locale)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-slate-200">{leg.odds.toFixed(2)}</p>
              <p className="font-mono text-[11px] text-slate-500">{(leg.probability * 100).toFixed(0)}% {t('packageCard.probLabel')}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 rounded-lg border border-[#232b3e] bg-black/20 p-3 text-xs leading-relaxed text-ink-muted">
        <span className="font-semibold text-slate-300">{t('packageCard.justificationTitle')} </span>
        {t('packageCard.justificationBody', { pct: probabilityPct })}
      </p>
    </div>
  );
}
