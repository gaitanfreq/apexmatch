const { query } = require('../db/pool');

/** Historial de recomendaciones ya resueltas (won/lost), ordenado cronológicamente. */
async function getSettledHistory({ limit = 500 } = {}) {
  const { rows } = await query(
    `SELECT id, kind, combined_odds AS "combinedOdds", model_probability AS "modelProbability",
            stake_amount AS "stakeAmount", status, profit_loss AS "profitLoss",
            bankroll_after AS "bankrollAfter", recommended_at AS "recommendedAt", settled_at AS "settledAt"
     FROM recommendation_records
     WHERE status IN ('won', 'lost')
     ORDER BY settled_at ASC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

async function insertRecommendationRecord({
  kind, matchIds, legs, combinedOdds, modelProbability, kellyStakeFraction, stakeAmount, bankrollBefore,
}) {
  const { rows } = await query(
    `INSERT INTO recommendation_records (
       kind, match_ids, legs, combined_odds, model_probability, kelly_stake_fraction,
       stake_amount, bankroll_before
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [kind, matchIds, JSON.stringify(legs), combinedOdds, modelProbability, kellyStakeFraction, stakeAmount, bankrollBefore]
  );
  return rows[0].id;
}

async function settleRecommendationRecord(id, { status, profitLoss, bankrollAfter }) {
  await query(
    `UPDATE recommendation_records
     SET status = $2, profit_loss = $3, bankroll_after = $4, settled_at = now()
     WHERE id = $1`,
    [id, status, profitLoss, bankrollAfter]
  );
}

module.exports = { getSettledHistory, insertRecommendationRecord, settleRecommendationRecord };
