const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

// Managed Postgres providers (Render, Railway) expose a single DATABASE_URL
// connection string instead of discrete PG* vars. Prefer it when present.
const pool = config.db.connectionString
  ? new Pool({
      connectionString: config.db.connectionString,
      ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined,
      max: config.db.maxPoolSize,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : new Pool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      max: config.db.maxPoolSize,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

pool.on('error', (err) => {
  // Errores en clientes idle del pool: no deben tirar el proceso.
  logger.error('Unexpected PostgreSQL pool error', { error: err.message });
});

async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    logger.debug('db query', { text, durationMs: Date.now() - start, rows: result.rowCount });
    return result;
  } catch (err) {
    logger.error('db query failed', { text, error: err.message });
    throw err;
  }
}

/** Ejecuta un callback dentro de una transacción, con rollback automático en error. */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
