'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useI18n } from './i18n/LanguageProvider';
import { SearchIcon } from './ui/icons';
import { displayCountryName, countryNameVariants } from '@/lib/countryNames';

function normalize(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // quita acentos para que "espana" encuentre "España"
}

/** Chips de selección de liga agrupados por país, con buscador por nombre de liga o país (ES/EN). */
export default function LeagueFilter({ leagues, selectedLeagueId, onSelect }) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = normalize(query);
    const filtered = q
      ? leagues.filter((l) => {
          if (normalize(l.name).includes(q)) return true;
          return countryNameVariants(l.countryName).some((variant) => normalize(variant).includes(q));
        })
      : leagues;

    const byCountry = new Map();
    for (const league of filtered) {
      const country = displayCountryName(league.countryName, locale) || t('leagueFilter.otherCountry');
      if (!byCountry.has(country)) byCountry.set(country, []);
      byCountry.get(country).push(league);
    }
    return [...byCountry.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [leagues, query, t, locale]);

  const totalMatches = groups.reduce((sum, [, ls]) => sum + ls.length, 0);

  return (
    <div className="space-y-3">
      <div className="relative max-w-xs">
        <SearchIcon width={14} height={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('leagueFilter.searchPlaceholder')}
          className="w-full rounded-lg border border-[#232b3e] bg-black/20 py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-neon-green focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
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

        {query && totalMatches === 0 && (
          <span className="text-xs text-ink-muted">{t('leagueFilter.noMatches')}</span>
        )}

        {groups.map(([country, countryLeagues]) => (
          <div key={country} className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{country}:</span>
            {countryLeagues.map((league) => (
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
        ))}
      </div>
    </div>
  );
}
