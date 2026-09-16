'use client';

import clsx from 'clsx';
import { useI18n } from './i18n/LanguageProvider';

/** Chips de selección de liga — "Todas" + una por cada liga trackeada con partidos. */
export default function LeagueFilter({ leagues, selectedLeagueId, onSelect }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={clsx(
          'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
          selectedLeagueId === null
            ? 'border-neon-green bg-neon-green/15 text-neon-green'
            : 'border-[#232b3e] bg-black/20 text-ink-muted hover:text-white'
        )}
      >
        {t('leagueFilter.allLeagues')}
      </button>
      {leagues.map((league) => (
        <button
          key={league.id}
          onClick={() => onSelect(league.id)}
          className={clsx(
            'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            selectedLeagueId === league.id
              ? 'border-neon-green bg-neon-green/15 text-neon-green'
              : 'border-[#232b3e] bg-black/20 text-ink-muted hover:text-white'
          )}
        >
          {league.name}
          <span className="rounded-full bg-white/10 px-1.5 text-[10px] text-ink-muted">
            {league.scheduledCount + league.liveCount}
          </span>
        </button>
      ))}
    </div>
  );
}
