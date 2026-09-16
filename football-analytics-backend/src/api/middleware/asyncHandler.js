/** Envuelve un handler async para que sus rechazos lleguen a errorHandler vía next(). */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
