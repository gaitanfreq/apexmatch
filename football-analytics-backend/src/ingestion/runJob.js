const logger = require('../utils/logger');
const ingestionRepo = require('../repositories/ingestionRepository');

/**
 * Envuelve un job de ingesta con trazabilidad estándar:
 *  - registra el run en ingestion_runs
 *  - captura errores por-entidad sin abortar todo el job (best-effort)
 *  - marca el run como success/partial/failed según haya o no fallos
 *
 * `handler` recibe un `ctx` con `{ reportError }` para registrar fallos puntuales
 * (ej. un fixture individual que falló) sin detener el resto del batch.
 */
async function runJob(jobName, handler, metadata = {}) {
  const runId = await ingestionRepo.startRun(jobName, metadata);
  let processed = 0;
  let failed = 0;
  const errors = [];

  const ctx = {
    reportError: async (entityType, entityProviderId, err, payload) => {
      failed += 1;
      errors.push(err.message);
      logger.error(`[${jobName}] failed processing ${entityType} ${entityProviderId}`, {
        error: err.message,
      });
      await ingestionRepo.logError(runId, {
        entityType,
        entityProviderId,
        errorMessage: err.message,
        payload,
      });
    },
    trackProcessed: (count = 1) => {
      processed += count;
    },
  };

  try {
    await handler(ctx);
    const status = failed === 0 ? 'success' : 'partial';
    await ingestionRepo.finishRun(runId, {
      status,
      recordsProcessed: processed,
      recordsFailed: failed,
      errorSummary: errors.slice(0, 5).join(' | ') || null,
    });
    logger.info(`[${jobName}] finished: ${status}`, { processed, failed });
    return { status, processed, failed };
  } catch (err) {
    // Fallo catastrófico (ej. la API no responde, DB caída): se registra y se relanza
    // para que el cron/caller decida (reintentar, alertar, etc).
    await ingestionRepo.finishRun(runId, {
      status: 'failed',
      recordsProcessed: processed,
      recordsFailed: failed,
      errorSummary: err.message,
    });
    logger.error(`[${jobName}] aborted`, { error: err.message });
    throw err;
  }
}

module.exports = { runJob };
