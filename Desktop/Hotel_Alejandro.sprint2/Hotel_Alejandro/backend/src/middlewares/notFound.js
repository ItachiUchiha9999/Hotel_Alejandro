/** Responde 404 en JSON para cualquier ruta no registrada. */
function notFound(req, res) {
  res.status(404).json({
    ok: false,
    message: `No existe el endpoint ${req.method} ${req.originalUrl}.`,
  });
}

module.exports = notFound;
