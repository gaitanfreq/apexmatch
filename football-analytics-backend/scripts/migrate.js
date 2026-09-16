#!/usr/bin/env node
/**
 * Migration runner minimalista: aplica en orden alfabético cada .sql en /migrations
 * que aún no esté registrado en schema_migrations. Cada archivo corre dentro de
 * su propia transacción.
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db/pool');
const logger = require('../src/utils/logger');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

async function run() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      logger.info('No pending migrations. Database is up to date.');
      return;
    }

    for (const filename of pending) {
      const filePath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filePath, 'utf8');

      logger.info(`Applying migration: ${filename}`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
        logger.info(`Applied: ${filename}`);
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error(`Migration failed: ${filename}`, { error: err.message });
        throw err;
      }
    }

    logger.info(`Done. Applied ${pending.length} migration(s).`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  logger.error('Migration run aborted', { error: err.message });
  process.exit(1);
});
