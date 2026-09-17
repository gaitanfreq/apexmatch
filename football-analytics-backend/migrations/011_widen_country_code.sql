-- API-Football usa códigos de país no-ISO más largos para constituyentes del
-- Reino Unido sin código alpha-3 propio (ej. "GB-ENG" para Inglaterra,
-- "GB-SCT" para Escocia) — VARCHAR(3) los rechaza. Detectado al probar el
-- pipeline real de sincronización de catálogo (syncCatalog) contra la API.
ALTER TABLE countries ALTER COLUMN code TYPE VARCHAR(10);
