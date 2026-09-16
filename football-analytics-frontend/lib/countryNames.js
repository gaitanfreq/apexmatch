/**
 * El backend guarda los nombres de país en español (columna countries.name).
 * Este mapa traduce esos valores para mostrarlos en inglés y para que el
 * buscador de ligas entienda ambos idiomas sin duplicar datos en la DB.
 */
const ES_TO_EN = {
  España: 'Spain',
  Inglaterra: 'England',
  Italia: 'Italy',
  Alemania: 'Germany',
  Francia: 'France',
  Colombia: 'Colombia',
  'Estados Unidos': 'United States',
  Europa: 'Europe',
};

export function displayCountryName(name, locale) {
  if (locale === 'en') return ES_TO_EN[name] ?? name;
  return name;
}

/** Todas las variantes conocidas de un nombre de país (ES + EN), para matching de búsqueda. */
export function countryNameVariants(name) {
  const en = ES_TO_EN[name];
  return en && en !== name ? [name, en] : [name];
}
