const logger = require('./logger');

/**
 * Reintenta una función async con backoff exponencial + jitter.
 * Usado para llamadas a APIs externas que pueden fallar transitoriamente
 * (rate limits, timeouts de red, 5xx).
 */
async function withRetry(fn, { retries = 3, baseDelayMs = 500, label = 'operation' } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === retries;
      const status = err.response?.status;

      // No reintentar errores de cliente no recuperables (401, 403, 404, 422)
      if ([401, 403, 404, 422].includes(status)) {
        throw err;
      }

      if (isLastAttempt) break;

      const delay = baseDelayMs * 2 ** (attempt - 1) + Math.random() * 200;
      logger.warn(`${label} failed (attempt ${attempt}/${retries}), retrying in ${Math.round(delay)}ms`, {
        error: err.message,
        status,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

module.exports = { withRetry };
