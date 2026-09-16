require('dotenv').config();

function required(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  db: {
    host: required('PGHOST', 'localhost'),
    port: Number(process.env.PGPORT || 5432),
    database: required('PGDATABASE'),
    user: required('PGUSER'),
    password: required('PGPASSWORD'),
    maxPoolSize: Number(process.env.PG_MAX_POOL || 10),
  },
  apiFootball: {
    baseUrl: required('API_FOOTBALL_BASE_URL', 'https://v3.football.api-sports.io'),
    apiKey: required('API_FOOTBALL_KEY'),
  },
  weather: {
    baseUrl: process.env.WEATHER_API_BASE_URL,
    apiKey: process.env.WEATHER_API_KEY,
  },
  trackedLeagueIds: (process.env.TRACKED_LEAGUE_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map(Number),
  currentSeasonYear: Number(process.env.CURRENT_SEASON_YEAR || new Date().getFullYear()),
  logLevel: process.env.LOG_LEVEL || 'info',
  // 'simulator' (default): genera partidos/odds automáticamente sin necesitar una
  // API_FOOTBALL_KEY real — ver src/ingestion/matchSimulator.js. 'api-football':
  // usa los jobs de sincronización reales de la Fase 1 (backfill/fixtures/odds).
  matchDataSource: process.env.MATCH_DATA_SOURCE || 'simulator',
  api: {
    port: Number(process.env.API_PORT || 4000),
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
    defaultBankroll: Number(process.env.DEFAULT_BANKROLL || 1000),
    kellyMultiplier: Number(process.env.KELLY_MULTIPLIER || 0.25),
    minEdge: Number(process.env.MIN_EDGE || 0.05),
    minParlayCumulativeProbability: Number(process.env.MIN_PARLAY_CUMULATIVE_PROBABILITY || 0.85),
  },
  admin: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    vipPriceId: process.env.STRIPE_VIP_PRICE_ID,
    successUrl: process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/vip?checkout=success',
    cancelUrl: process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/vip?checkout=cancelled',
  },
};
