'use client';

import clsx from 'clsx';
import { useI18n } from './i18n/LanguageProvider';

const RISK_STYLES = {
  low: { key: 'riskBadge.low', className: 'bg-neon-green/15 text-neon-green' },
  medium: { key: 'riskBadge.medium', className: 'bg-electric-blue/15 text-electric-blue' },
  high: { key: 'riskBadge.high', className: 'bg-neon-magenta/15 text-neon-magenta' },
};

export default function RiskBadge({ level = 'medium' }) {
  const { t } = useI18n();
  const style = RISK_STYLES[level] ?? RISK_STYLES.medium;
  return <span className={clsx('badge', style.className)}>{t(style.key)}</span>;
}
