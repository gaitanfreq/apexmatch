'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '@/lib/translations';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'apexmatch_locale';

function resolve(dict, key) {
  return key.split('.').reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), dict);
}

function interpolate(str, values) {
  if (!values) return str;
  return Object.entries(values).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), str);
}

/** Provee el idioma activo (es/en) a toda la app, persistido en localStorage. */
export default function LanguageProvider({ children }) {
  const [locale, setLocaleState] = useState('es');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'es' || stored === 'en') setLocaleState(stored);
    } catch {
      // localStorage inaccesible (modo privado, etc.) — se queda en el default 'es'.
    }
  }, []);

  function setLocale(next) {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // no-op
    }
  }

  const t = useMemo(() => {
    return (key, values) => {
      const raw = resolve(translations[locale], key) ?? resolve(translations.es, key) ?? key;
      return interpolate(raw, values);
    };
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useI18n debe usarse dentro de <LanguageProvider>');
  return ctx;
}
