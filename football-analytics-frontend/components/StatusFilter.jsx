'use client';

import clsx from 'clsx';
import { useI18n } from './i18n/LanguageProvider';

const OPTIONS = [
  { key: 'upcoming', tKey: 'statusFilter.upcoming', statuses: ['scheduled'] },
  { key: 'live', tKey: 'statusFilter.live', statuses: ['live'] },
  { key: 'finished', tKey: 'statusFilter.finished', statuses: ['finished'] },
  { key: 'all', tKey: 'statusFilter.all', statuses: ['scheduled', 'live', 'finished'] },
];

export { OPTIONS as STATUS_FILTER_OPTIONS };

/** Tabs de estado del partido (Programados / En Vivo / Finalizados / Todos). */
export default function StatusFilter({ selectedKey, onSelect }) {
  const { t } = useI18n();
  return (
    <div className="flex rounded-lg border border-[#232b3e] bg-black/20 p-0.5 text-xs">
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onSelect(opt.key)}
          className={clsx(
            'rounded-md px-3 py-1.5 font-medium transition-colors',
            selectedKey === opt.key ? 'bg-[#232b3e] text-white' : 'text-ink-muted hover:text-white'
          )}
        >
          {t(opt.tKey)}
        </button>
      ))}
    </div>
  );
}
