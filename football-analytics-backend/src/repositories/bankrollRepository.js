const { query } = require('../db/pool');

const DEFAULT_SETTINGS = { initialBankroll: 1000, stakeUnitType: 'fixed', stakeUnitValue: 25 };

async function getSettings(userId) {
  const { rows } = await query(
    `SELECT initial_bankroll AS "initialBankroll", stake_unit_type AS "stakeUnitType",
            stake_unit_value AS "stakeUnitValue", updated_at AS "updatedAt"
     FROM user_bankroll_settings WHERE user_id = $1`,
    [userId]
  );
  if (!rows[0]) return { ...DEFAULT_SETTINGS, updatedAt: null };
  return {
    initialBankroll: Number(rows[0].initialBankroll),
    stakeUnitType: rows[0].stakeUnitType,
    stakeUnitValue: Number(rows[0].stakeUnitValue),
    updatedAt: rows[0].updatedAt,
  };
}

async function upsertSettings(userId, { initialBankroll, stakeUnitType, stakeUnitValue }) {
  const { rows } = await query(
    `INSERT INTO user_bankroll_settings (user_id, initial_bankroll, stake_unit_type, stake_unit_value)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       initial_bankroll = EXCLUDED.initial_bankroll,
       stake_unit_type = EXCLUDED.stake_unit_type,
       stake_unit_value = EXCLUDED.stake_unit_value,
       updated_at = now()
     RETURNING initial_bankroll AS "initialBankroll", stake_unit_type AS "stakeUnitType",
               stake_unit_value AS "stakeUnitValue", updated_at AS "updatedAt"`,
    [userId, initialBankroll, stakeUnitType, stakeUnitValue]
  );
  return {
    initialBankroll: Number(rows[0].initialBankroll),
    stakeUnitType: rows[0].stakeUnitType,
    stakeUnitValue: Number(rows[0].stakeUnitValue),
    updatedAt: rows[0].updatedAt,
  };
}

/** Historial completo de apuestas del usuario, ordenado cronológicamente ascendente (para la curva de bankroll). */
async function listBets(userId, { limit = 500 } = {}) {
  const { rows } = await query(
    `SELECT id, match_label AS "matchLabel", market, odds_decimal AS "oddsDecimal",
            stake_amount AS "stakeAmount", result, profit_loss AS "profitLoss",
            placed_at AS "placedAt"
     FROM user_bets
     WHERE user_id = $1
     ORDER BY placed_at ASC
     LIMIT $2`,
    [userId, limit]
  );
  return rows.map((r) => ({
    ...r,
    oddsDecimal: Number(r.oddsDecimal),
    stakeAmount: Number(r.stakeAmount),
    profitLoss: Number(r.profitLoss),
  }));
}

function computeProfitLoss(result, stakeAmount, oddsDecimal) {
  if (result === 'won') return stakeAmount * (oddsDecimal - 1);
  if (result === 'lost') return -stakeAmount;
  return 0; // void
}

async function insertBet(userId, { matchLabel, market, oddsDecimal, stakeAmount, result, placedAt }) {
  const profitLoss = computeProfitLoss(result, stakeAmount, oddsDecimal);

  const { rows } = await query(
    `INSERT INTO user_bets (user_id, match_label, market, odds_decimal, stake_amount, result, profit_loss, placed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8, now()))
     RETURNING id, match_label AS "matchLabel", market, odds_decimal AS "oddsDecimal",
               stake_amount AS "stakeAmount", result, profit_loss AS "profitLoss", placed_at AS "placedAt"`,
    [userId, matchLabel, market ?? null, oddsDecimal, stakeAmount, result, profitLoss, placedAt ?? null]
  );

  const row = rows[0];
  return { ...row, oddsDecimal: Number(row.oddsDecimal), stakeAmount: Number(row.stakeAmount), profitLoss: Number(row.profitLoss) };
}

/** Elimina una apuesta, solo si pertenece al usuario. Devuelve true si borró algo. */
async function deleteBet(userId, betId) {
  const { rowCount } = await query('DELETE FROM user_bets WHERE id = $1 AND user_id = $2', [betId, userId]);
  return rowCount > 0;
}

module.exports = {
  getSettings,
  upsertSettings,
  listBets,
  insertBet,
  deleteBet,
  computeProfitLoss,
  DEFAULT_SETTINGS,
};
