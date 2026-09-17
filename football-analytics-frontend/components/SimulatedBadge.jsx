'use client';

import { useI18n } from './i18n/LanguageProvider';

/** Badge chico visible por-tarjeta cuando el partido/cuota viene del simulador (no es un fixture real). */
export default function SimulatedBadge({ isSimulated }) {
  const { t } = useI18n();
  if (!isSimulated) return null;

  return (
    <span
      className="badge bg-electric-blue/15 text-electric-blue"
      title={t('methodology.simulatedMatchTooltip')}
    >
      {t('methodology.simulatedMatchBadge')}
    </span>
  );
}
