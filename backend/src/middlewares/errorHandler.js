const env = require('../config/env');

/**
 * Manejador central de errores. Toda respuesta de error del sistema sale de acá
 * con la misma forma: { ok: false, message }. El frontend siempre lee `message`.
 */
function errorHandler(err, req, res, _next) {
  // 1. Errores de negocio: ya traen status y un mensaje presentable.
  if (err.name === 'AppError') {
    return res.status(err.status || 400).json({ ok: false, message: err.message });
  }

  // 2. Errores conocidos de Prisma
  if (err.code === 'P2002') {
    const campo = err.meta?.target?.[0] ?? 'ese valor';
    return res.status(409).json({ ok: false, message: `Ya existe un registro con ${campo}.` });
  }
  if (err.code === 'P2003') {
    return res.status(409).json({
      ok: false,
      message: 'Alguno de los datos referenciados no existe en la base.',
    });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ ok: false, message: 'El registro solicitado no existe.' });
  }

  // 3. CHECK constraints y triggers de PostgreSQL (stock negativo, depósito
  //    inactivo, transferencia sin destino). El mensaje del RAISE ya es claro.
  const texto = String(err.message || '');
  if (err.code === '23514' || err.code === 'P0001' || texto.includes('RAISE')) {
    const primeraLinea = texto.split('\n').find((l) => l.includes('EXCEPTION') || l.trim()) || texto;
    return res.status(409).json({
      ok: false,
      message: primeraLinea.replace(/^.*EXCEPTION:?\s*/i, '').trim() ||
        'La operación no cumple con las reglas del stock.',
    });
  }

  console.error('[error]', err);
  return res.status(500).json({
    ok: false,
    message: 'Ocurrió un error inesperado en el servidor.',
    ...(env.NODE_ENV === 'development' ? { detalle: err.message } : {}),
  });
}

module.exports = errorHandler;
