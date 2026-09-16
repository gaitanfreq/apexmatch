'use client';

import { useI18n } from './i18n/LanguageProvider';
import { formatKickoff } from '@/lib/formatDate';

function matchLabel(bet, t) {
  if (bet.homeTeamName && bet.awayTeamName) return `${bet.homeTeamName} vs. ${bet.awayTeamName}`;
  return t('match.match', { id: bet.matchId });
}

/** Tarjeta de Value Bet — edge sobre la cuota del bookmaker. Contenido VIP (magenta neón). */
export default function ValueBetCard({ bet }) {
  const { t, locale } = useI18n();
  const edgePct = (bet.edge * 100).toFixed(1);
  const ourProbPct = (bet.ourProbability * 100).toFixed(1);
  const impliedProbPct = (bet.impliedProbability * 100).toFixed(1);

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-ink-muted">{formatKickoff(bet.kickoffAt, locale)} · {matchLabel(bet, t)}</p>
          <h4 className="text-sm font-semibold text-white">
            {bet.market} <span className="text-neon-magenta">— {bet.selection}</span>
          </h4>
          <p className="text-xs text-ink-muted">{t('valueBetCard.house')}: {bet.bookmaker}</p>
        </div>
        <span className="badge bg-neon-magenta/15 text-neon-magenta glow-text-magenta">{t('match.edge')} +{edgePct}%</span>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-ink-muted">{t('valueBetCard.odds')}</p>
          <p className="font-mono text-base font-semibold text-white">{bet.oddsDecimal.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-ink-muted">{t('valueBetCard.fairOdds')}</p>
          <p className="font-mono text-base font-semibold text-slate-300">{bet.fairOdds.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-ink-muted">{t('valueBetCard.ourProb')}</p>
          <p className="font-mono text-base font-semibold text-electric-blue">{ourProbPct}%</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-ink-muted">{t('valueBetCard.impliedProb')}</p>
          <p className="font-mono text-base font-semibold text-slate-400">{impliedProbPct}%</p>
        </div>
      </div>

      {bet.kellyStake && (
        <div className="flex items-center justify-between rounded-lg border border-neon-magenta/30 bg-neon-magenta/10 px-3 py-2 text-xs">
          <span className="text-slate-300">{t('valueBetCard.recommendedStake')}</span>
          <span className="font-mono font-semibold text-neon-magenta">
            {bet.kellyStake.recommendedFraction > 0
              ? `${(bet.kellyStake.recommendedFraction * 100).toFixed(2)}% ${t('valueBetCard.ofBankroll')} ($${bet.kellyStake.recommendedStake.toFixed(2)})`
              : t('valueBetCard.dontBet')}
          </span>
        </div>
      )}
    </div>
  );
}
