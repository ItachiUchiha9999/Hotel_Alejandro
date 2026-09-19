/**
 * Envuelve un handler async para que cualquier throw llegue al errorHandler
 * en lugar de quedar como promesa rechazada sin atender.
 * Evita repetir try/catch en todos los controllers.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
