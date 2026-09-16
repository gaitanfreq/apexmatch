const { query } = require('../db/pool');

/** Guarda (o actualiza) la predicción calculada para un partido. */
async function upsert(matchId, { homeXg, awayXg, markets, topScores, valueBets }) {
  await query(
    `INSERT INTO match_predictions_cache (match_id, home_xg, away_xg, markets, top_scores, value_bets, computed_at)
     VALUES ($1,$2,$3,$4,$5,$6, now())
     ON CONFLICT (match_id) DO UPDATE SET
       home_xg = EXCLUDED.home_xg, away_xg = EXCLUDED.away_xg, markets = EXCLUDED.markets,
       top_scores = EXCLUDED.top_scores, value_bets = EXCLUDED.value_bets, computed_at = now()`,
    [matchId, homeXg, awayXg, JSON.stringify(markets), JSON.stringify(topScores), JSON.stringify(valueBets)]
  );
}

/** Predicción cacheada de un partido, o null si no existe o está vencida (más vieja que maxAgeMinutes). */
async function getByMatchId(matchId, { maxAgeMinutes = 30 } = {}) {
  const { rows } = await query(
    `SELECT home_xg::double precision AS "homeXg", away_xg::double precision AS "awayXg",
            markets, top_scores AS "topScores", value_bets AS "valueBets", computed_at AS "computedAt"
     FROM match_predictions_cache
     WHERE match_id = $1 AND computed_at > now() - ($2 || ' minutes')::interval`,
    [matchId, maxAgeMinutes]
  );
  return rows[0] ?? null;
}

module.exports = { upsert, getByMatchId };
