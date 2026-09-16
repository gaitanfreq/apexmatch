#!/usr/bin/env node
const { createApp } = require('./app');
const config = require('../config');
const logger = require('../utils/logger');
const { pool } = require('../db/pool');

async function main() {
  await pool.query('SELECT 1');
  logger.info('Database connection OK.');

  const app = createApp();
  const server = app.listen(config.api.port, () => {
    logger.info(`Football analytics API listening on port ${config.api.port}`);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down API server.');
    server.close(() => pool.end().then(() => process.exit(0)));
  });
}

main().catch((err) => {
  logger.error('Fatal error starting API server', { error: err.message });
  process.exit(1);
});
