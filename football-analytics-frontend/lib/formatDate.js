const LOCALE_TAGS = { es: 'es-ES', en: 'en-US' };

/** Formatea una fecha/hora corta (día, mes, hora) respetando el idioma activo. */
export function formatKickoff(value, locale = 'es') {
  if (!value) return '';
  return new Date(value).toLocaleString(LOCALE_TAGS[locale] ?? LOCALE_TAGS.es, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Formatea solo fecha (día, mes) — usado en ejes de gráficos. */
export function formatShortDate(value, locale = 'es') {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString(LOCALE_TAGS[locale] ?? LOCALE_TAGS.es, { day: '2-digit', month: 'short' });
  } catch {
    return value;
  }
}

/** Formatea fecha larga (día, mes, año) — usado en tablas de admin. */
export function formatLongDate(value, locale = 'es') {
  return new Date(value).toLocaleDateString(LOCALE_TAGS[locale] ?? LOCALE_TAGS.es, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
