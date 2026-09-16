const { query } = require('../db/pool');

async function upsertBookmaker(providerBookmakerId, name) {
  const { rows } = await query(
    `INSERT INTO bookmakers (provider_bookmaker_id, name)
     VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET provider_bookmaker_id = EXCLUDED.provider_bookmaker_id
     RETURNING id`,
    [providerBookmakerId, name]
  );
  return rows[0].id;
}

async function upsertMarket(providerMarketId, name) {
  const { rows } = await query(
    `INSERT INTO odds_markets (provider_market_id, name)
     VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET provider_market_id = EXCLUDED.provider_market_id
     RETURNING id`,
    [providerMarketId, name]
  );
  return rows[0].id;
}

/**
 * Inserta un snapshot de cuota. Es append-only por diseño: cada llamada crea
 * una nueva fila para poder reconstruir la evolución histórica de la cuota.
 */
async function insertOddsSnapshot({ matchId, bookmakerId, marketId, selection, handicap, oddsDecimal, isClosingLine }) {
  await query(
    `INSERT INTO odds_snapshots (match_id, bookmaker_id, market_id, selection, handicap, odds_decimal, is_closing_line)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [matchId, bookmakerId, marketId, selection, handicap, oddsDecimal, isClosingLine || false]
  );
}

module.exports = { upsertBookmaker, upsertMarket, insertOddsSnapshot };
