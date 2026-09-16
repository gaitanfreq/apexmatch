import clsx from 'clsx';

const STATUS_META = {
  scheduled: { label: 'Programado', className: 'bg-electric-blue/15 text-electric-blue' },
  live: { label: 'En Vivo', className: 'bg-neon-magenta/15 text-neon-magenta' },
  finished: { label: 'Finalizado', className: 'bg-white/5 text-ink-muted' },
};

/** Badge de estado del partido — punto pulsante para "En Vivo". */
export default function MatchStatusBadge({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.scheduled;
  return (
    <span className={clsx('badge', meta.className)}>
      {status === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon-magenta" />}
      {meta.label}
    </span>
  );
}
