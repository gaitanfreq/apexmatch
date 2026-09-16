/**
 * Middleware genérico de validación con Zod. Valida query/body contra un
 * schema y responde 400 con detalles legibles si falla, en vez de dejar que
 * un valor inesperado se propague a la capa de negocio.
 */
function validate({ query: querySchema, body: bodySchema, params: paramsSchema } = {}) {
  return (req, res, next) => {
    if (querySchema) {
      const result = querySchema.safeParse(req.query);
      if (!result.success) {
        return res.status(400).json({
          error: 'invalid_query',
          issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        });
      }
      req.query = result.data;
    }

    if (bodySchema) {
      const result = bodySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          error: 'invalid_body',
          issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        });
      }
      req.body = result.data;
    }

    if (paramsSchema) {
      const result = paramsSchema.safeParse(req.params);
      if (!result.success) {
        return res.status(400).json({
          error: 'invalid_params',
          issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        });
      }
      req.params = result.data;
    }

    next();
  };
}

module.exports = { validate };
