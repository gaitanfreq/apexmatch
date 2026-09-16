'use client';

import { API_URL } from '@/lib/api';
import { useI18n } from './i18n/LanguageProvider';

/** Estado de error reutilizable cuando el backend de analítica no responde. */
export default function ApiErrorState({ message }) {
  const { t } = useI18n();
  return (
    <div className="card border-neon-magenta/30 p-6 text-center text-sm text-ink-muted">
      <p className="mb-1 font-medium text-neon-magenta">{t('apiError.title')}</p>
      <p>{message || t('apiError.fallback', { url: API_URL })}</p>
    </div>
  );
}
