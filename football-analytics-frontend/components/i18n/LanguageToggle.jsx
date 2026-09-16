'use client';

import clsx from 'clsx';
import { useI18n } from './LanguageProvider';

/** Selector compacto ES/EN. */
export default function LanguageToggle({ className }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className={clsx('flex rounded-lg border border-[#232b3e] bg-black/20 p-0.5 text-[11px]', className)}>
      {['es', 'en'].map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={clsx(
            'rounded-md px-2 py-1 font-semibold transition-colors',
            locale === code ? 'bg-[#232b3e] text-white' : 'text-ink-muted hover:text-white'
          )}
        >
          {t(`language.${code}`)}
        </button>
      ))}
    </div>
  );
}
