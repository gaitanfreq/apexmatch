const logger = require('./utils/logger');
const { pool } = require('./db/pool');
const { startCronJobs } = require('./cron');

async function main() {
  await pool.query('SELECT 1'); // valida conexión a DB antes de arrancar los crons
  logger.info('Database connection OK.');

  startCronJobs();
  logger.info('Football analytics ingestion service is running.');
}

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled promise rejection', { error: err?.message ?? String(err) });
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully.');
  await pool.end();
  process.exit(0);
});

main().catch((err) => {
  logger.error('Fatal error during startup', { error: err.message });
  process.exit(1);
});
