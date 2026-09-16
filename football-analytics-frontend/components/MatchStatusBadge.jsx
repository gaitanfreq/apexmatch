'use client';

import clsx from 'clsx';
import { useI18n } from './i18n/LanguageProvider';

const STATUS_META = {
  scheduled: { key: 'matchStatus.scheduled', className: 'bg-electric-blue/15 text-electric-blue' },
  live: { key: 'matchStatus.live', className: 'bg-neon-magenta/15 text-neon-magenta' },
  finished: { key: 'matchStatus.finished', className: 'bg-white/5 text-ink-muted' },
};

/** Badge de estado del partido — punto pulsante para "En Vivo". */
export default function MatchStatusBadge({ status }) {
  const { t } = useI18n();
  const meta = STATUS_META[status] ?? STATUS_META.scheduled;
  return (
    <span className={clsx('badge', meta.className)}>
      {status === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon-magenta" />}
      {t(meta.key)}
    </span>
  );
}
