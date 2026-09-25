/**
 * Error de negocio con código HTTP.
 * Permite que el manejador central distinga un 404 de un 409 sin parsear
 * mensajes de texto.
 */
class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

const noEncontrado = (msg) => new AppError(msg, 404);
const conflicto = (msg) => new AppError(msg, 409);
const invalido = (msg) => new AppError(msg, 400);

module.exports = { AppError, noEncontrado, conflicto, invalido };
