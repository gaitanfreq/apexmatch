const logger = require('../../utils/logger');

/** Handler de errores centralizado: nunca filtra stack traces al cliente. */
function errorHandler(err, req, res, _next) { // eslint-disable-line no-unused-vars
  logger.error('Unhandled API error', { path: req.path, error: err.message, stack: err.stack });

  const status = err.status || 500;
  res.status(status).json({
    error: err.code || 'internal_error',
    message: status >= 500 ? 'Ocurrió un error interno.' : err.message,
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'not_found', message: `Route ${req.method} ${req.path} not found` });
}

module.exports = { errorHandler, notFoundHandler };
