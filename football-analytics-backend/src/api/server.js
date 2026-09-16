#!/usr/bin/env node
const { createApp } = require('./app');
const config = require('../config');
const logger = require('../utils/logger');
const { pool } = require('../db/pool');
const { startCronJobs } = require('../cron');

async function main() {
  await pool.query('SELECT 1');
  logger.info('Database connection OK.');

  const app = createApp();
  const server = app.listen(config.api.port, () => {
    logger.info(`Football analytics API listening on port ${config.api.port}`);
  });

  // En plataformas cuyo plan gratuito no ofrece un proceso "worker" separado
  // (ej. Render free tier), el proceso de la API también corre los cron jobs
  // de ingesta/predicciones. Desactivable con RUN_CRON_IN_API=false si se
  // despliega un worker dedicado aparte (ver src/index.js).
  if (process.env.RUN_CRON_IN_API !== 'false') {
    startCronJobs();
  }

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down API server.');
    server.close(() => pool.end().then(() => process.exit(0)));
  });
}

main().catch((err) => {
  logger.error('Fatal error starting API server', { error: err.message });
  process.exit(1);
});
