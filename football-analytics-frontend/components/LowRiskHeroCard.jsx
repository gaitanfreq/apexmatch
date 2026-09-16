'use client';

import { useI18n } from './i18n/LanguageProvider';
import { formatKickoff } from '@/lib/formatDate';

function matchLabel(leg, t) {
  if (leg.homeTeamName && leg.awayTeamName) return `${leg.homeTeamName} vs. ${leg.awayTeamName}`;
  return t('match.match', { id: leg.matchId });
}

/**
 * Tarjeta destacada del "pick del día" de bajo riesgo — Sección Gratuita.
 * Contenedor verde neón brillante, réplica del hero card de la identidad ApexMatch.
 */
export default function LowRiskHeroCard({ pkg }) {
  const { t, locale } = useI18n();
  if (!pkg) return null;

  const probabilityPct = (pkg.cumulativeProbability * 100).toFixed(0);
  const stakePct = pkg.kellyStake?.recommendedFraction ? (pkg.kellyStake.recommendedFraction * 100).toFixed(0) : null;

  return (
    <div className="card relative overflow-hidden border-neon-green/40 p-6 shadow-glow-green">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-neon-green/10 blur-3xl" />

      <div className="relative flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
          {t('lowRiskHero.title')} <span className="text-neon-green">{t('lowRiskHero.free')}</span>
        </h3>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00FF87" strokeWidth="2" className="glow-text-green">
          <path d="M3 17 L9 11 L13 15 L21 7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 7 H21 V13" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="relative mt-4 space-y-2">
        {pkg.legs.map((leg, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium text-white">{matchLabel(leg, t)}</p>
              <p className="text-xs text-ink-muted">
                {leg.market} · {leg.selection} · {formatKickoff(leg.kickoffAt, locale)}
              </p>
            </div>
            <span className="font-mono text-sm text-slate-300">{leg.odds.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-4 border-t border-neon-green/20 pt-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">{t('lowRiskHero.calculatedProbability')}</p>
          <p className="stat-value text-neon-green glow-text-green">{probabilityPct}%</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">{t('lowRiskHero.suggestedStake')}</p>
          <p className="stat-value text-white">{stakePct != null ? `${stakePct}%` : '—'} <span className="text-xs font-normal text-ink-muted">(Kelly)</span></p>
        </div>
      </div>
    </div>
  );
}
