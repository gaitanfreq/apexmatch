'use client';

import clsx from 'clsx';
import { useI18n } from './i18n/LanguageProvider';

const STYLES = {
  ADMIN: 'bg-neon-magenta/15 text-neon-magenta glow-text-magenta',
  VIP: 'bg-neon-green/15 text-neon-green glow-text-green',
  FREE: 'bg-white/5 text-ink-muted',
};

/** Deriva el rol "efectivo" mostrado en la UI a partir de session.user (role de cuenta + plan de facturación). */
export function effectiveRole(user) {
  if (user?.role === 'admin') return 'ADMIN';
  if (user?.plan === 'vip') return 'VIP';
  return 'FREE';
}

export default function RoleBadge({ role, className }) {
  const { t } = useI18n();
  return (
    <span className={clsx('badge', STYLES[role] ?? STYLES.FREE, className)}>
      {role === 'ADMIN' ? t('roleBadge.admin') : role}
    </span>
  );
}
