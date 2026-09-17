const axios = require('axios');
const Bottleneck = require('bottleneck');
const config = require('../config');
const logger = require('../utils/logger');
const { withRetry } = require('../utils/retry');

/**
 * Cliente para API-Football (api-sports.io). Centraliza:
 *  - autenticación via header
 *  - rate limiting (el plan free suele limitar a ~10 req/min)
 *  - reintentos con backoff en fallos transitorios
 *  - normalización de errores para que los servicios de ingesta decidan qué hacer
 */

const http = axios.create({
  baseURL: config.apiFootball.baseUrl,
  timeout: 15000,
  headers: {
    'x-apisports-key': config.apiFootball.apiKey,
  },
});

// Ajustar minTime según el plan contratado (free tier: 10 req/min ~ 1 cada 6s)
const limiter = new Bottleneck({
  reservoir: 10,
  reservoirRefreshAmount: 10,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 1,
  minTime: 600,
});

class ApiFootballError extends Error {
  constructor(message, { status, endpoint, params } = {}) {
    super(message);
    this.name = 'ApiFootballError';
    this.status = status;
    this.endpoint = endpoint;
    this.params = params;
  }
}

async function get(endpoint, params = {}) {
  return limiter.schedule(() =>
    withRetry(
      async () => {
        try {
          const { data } = await http.get(endpoint, { params });

          const hasErrors = Array.isArray(data.errors)
            ? data.errors.length > 0
            : Object.keys(data.errors || {}).length > 0;

          if (hasErrors) {
            const apiError = new ApiFootballError(`API-Football returned errors for ${endpoint}`, {
              endpoint,
              params,
              status: 200,
            });
            apiError.errors = data.errors;
            throw apiError;
          }

          return data.response;
        } catch (err) {
          if (err instanceof ApiFootballError) throw err;
          const status = err.response?.status;
          logger.error('API-Football request failed', { endpoint, params, status, message: err.message });
          throw new ApiFootballError(err.message, { status, endpoint, params });
        }
      },
      { retries: 3, baseDelayMs: 1000, label: `API-Football:${endpoint}` }
    )
  );
}

module.exports = {
  get,
  ApiFootballError,
  endpoints: {
    leagues: () => get('/leagues'),
    teamsByLeague: (leagueId, season) => get('/teams', { league: leagueId, season }),
    fixturesByLeagueSeason: (leagueId, season) => get('/fixtures', { league: leagueId, season }),
    // `season` es obligatorio cuando se combina con `league` (la API rechaza el
    // request si falta) — detectado probando este endpoint contra datos reales.
    fixturesByDateRange: (from, to, leagueId, season) =>
      get('/fixtures', { from, to, league: leagueId, season, timezone: 'UTC' }),
    fixtureStatistics: (fixtureId) => get('/fixtures/statistics', { fixture: fixtureId }),
    fixtureLineups: (fixtureId) => get('/fixtures/lineups', { fixture: fixtureId }),
    odds: (fixtureId) => get('/odds', { fixture: fixtureId }),
    oddsLive: (fixtureId) => get('/odds/live', { fixture: fixtureId }),
    injuries: (leagueId, season) => get('/injuries', { league: leagueId, season }),
    playersSquad: (teamId) => get('/players/squads', { team: teamId }),
  },
};
