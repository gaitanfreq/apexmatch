const { query } = require('../db/pool');

async function startRun(jobName, metadata = {}) {
  const { rows } = await query(
    `INSERT INTO ingestion_runs (job_name, status, metadata) VALUES ($1, 'running', $2) RETURNING id`,
    [jobName, metadata]
  );
  return rows[0].id;
}

async function finishRun(runId, { status, recordsProcessed, recordsFailed, errorSummary }) {
  await query(
    `UPDATE ingestion_runs
     SET status = $2, finished_at = now(), records_processed = $3, records_failed = $4, error_summary = $5
     WHERE id = $1`,
    [runId, status, recordsProcessed, recordsFailed, errorSummary]
  );
}

async function logError(runId, { entityType, entityProviderId, errorMessage, payload }) {
  await query(
    `INSERT INTO ingestion_errors (ingestion_run_id, entity_type, entity_provider_id, error_message, payload)
     VALUES ($1,$2,$3,$4,$5)`,
    [runId, entityType, String(entityProviderId ?? ''), errorMessage, payload ? JSON.stringify(payload) : null]
  );
}

async function setWatermark(resource) {
  await query(
    `INSERT INTO sync_watermarks (resource, last_synced_at) VALUES ($1, now())
     ON CONFLICT (resource) DO UPDATE SET last_synced_at = now()`,
    [resource]
  );
}

async function getWatermark(resource) {
  const { rows } = await query('SELECT last_synced_at FROM sync_watermarks WHERE resource = $1', [resource]);
  return rows[0]?.last_synced_at ?? null;
}

module.exports = { startRun, finishRun, logError, setWatermark, getWatermark };
