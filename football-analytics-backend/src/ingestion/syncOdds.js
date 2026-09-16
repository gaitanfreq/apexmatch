const apiFootball = require('../services/apiFootballClient');
const oddsRepo = require('../repositories/oddsRepository');
const { query } = require('../db/pool');
const { runJob } = require('./runJob');

/**
 * Sincroniza cuotas para partidos próximos (dentro de una ventana de días).
 * Diseñado para correr frecuentemente vía cron: cada corrida agrega nuevos
 * snapshots de cuota (no sobrescribe), permitiendo reconstruir la evolución.
 */
async function syncOddsForUpcomingMatches({ withinHours = 72 } = {}) {
  return runJob('sync_odds', async (ctx) => {
    const { rows: upcomingMatches } = await query(
      `SELECT id, provider_fixture_id FROM matches
       WHERE status = 'scheduled'
         AND kickoff_at BETWEEN now() AND now() + ($1 || ' hours')::interval`,
      [withinHours]
    );

    for (const match of upcomingMatches) {
      try {
        await syncOddsForFixture(match.id, match.provider_fixture_id);
        ctx.trackProcessed(1);
      } catch (err) {
        await ctx.reportError('odds', match.provider_fixture_id, err);
      }
    }
  });
}

async function syncOddsForFixture(matchId, providerFixtureId) {
  const oddsResponse = await apiFootball.endpoints.odds(providerFixtureId);

  for (const entry of oddsResponse) {
    for (const bookmakerEntry of entry.bookmakers || []) {
      const bookmakerId = await oddsRepo.upsertBookmaker(bookmakerEntry.id, bookmakerEntry.name);

      for (const bet of bookmakerEntry.bets || []) {
        const marketId = await oddsRepo.upsertMarket(bet.id, bet.name);

        for (const value of bet.values || []) {
          const { selection, handicap } = parseSelection(value.value);
          await oddsRepo.insertOddsSnapshot({
            matchId,
            bookmakerId,
            marketId,
            selection,
            handicap,
            oddsDecimal: Number(value.odd),
          });
        }
      }
    }
  }
}

/** API-Football codifica handicaps dentro del string de selección, ej. "Over 2.5" */
function parseSelection(rawValue) {
  const match = rawValue.match(/^(.*?)(-?\d+(\.\d+)?)$/);
  if (match && /over|under|handicap/i.test(rawValue)) {
    return { selection: match[1].trim(), handicap: Number(match[2]) };
  }
  return { selection: rawValue, handicap: null };
}

/** Marca como cierre (closing line) la última cuota antes del kickoff. Ejecutar poco antes del partido. */
async function markClosingLines() {
  await query(`
    UPDATE odds_snapshots os
    SET is_closing_line = true
    FROM (
      SELECT DISTINCT ON (match_id, bookmaker_id, market_id, selection, handicap)
        id
      FROM odds_snapshots
      ORDER BY match_id, bookmaker_id, market_id, selection, handicap, captured_at DESC
    ) latest
    WHERE os.id = latest.id
      AND os.match_id IN (
        SELECT id FROM matches WHERE kickoff_at BETWEEN now() - interval '15 minutes' AND now()
      )
  `);
}

module.exports = { syncOddsForUpcomingMatches, syncOddsForFixture, markClosingLines };
