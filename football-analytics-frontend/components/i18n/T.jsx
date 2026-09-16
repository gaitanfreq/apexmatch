'use client';

import { useI18n } from './LanguageProvider';

/** Helper para insertar texto traducido dentro de un Server Component: <T k="home.title" />. */
export default function T({ k, values }) {
  const { t } = useI18n();
  return t(k, values);
}
