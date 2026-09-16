'use client';

import { useState } from 'react';
import { useI18n } from './i18n/LanguageProvider';

/**
 * Nota de transparencia mostrada a todos los usuarios (Free y VIP): explica
 * en qué se basa el modelo, qué diferencia a cada plan, y deja explícito que
 * los partidos/cuotas de hoy son generados por el simulador (no hay todavía
 * una fuente de datos real conectada). Colapsable para no ocupar espacio
 * permanentemente una vez que el usuario ya la leyó.
 */
export default function MethodologyNote() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="card border-electric-blue/25 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          ℹ️ {t('methodology.title')}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <span className="badge bg-electric-blue/15 text-electric-blue">{t('methodology.demoDataBadge')}</span>
          <span className="text-ink-muted text-xs">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-2 border-t border-[#232b3e] pt-3 text-xs leading-relaxed text-ink-muted">
          <p>{t('methodology.howItWorks')}</p>
          <p>{t('methodology.freeVsVip')}</p>
          <p className="text-electric-blue">{t('methodology.demoDataNote')}</p>
        </div>
      )}
    </div>
  );
}
