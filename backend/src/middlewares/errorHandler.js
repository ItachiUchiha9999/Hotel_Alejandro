function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === '23503') {
    // foreign_key_violation
    return res.status(400).json({ error: 'Referencia inválida a otro registro' });
  }

  if (err.message && err.message.includes('inactivo')) {
    // viene del trigger trg_check_deposit_active (Historia STK-01)
    return res.status(409).json({ error: err.message.split('\n')[0] });
  }

  return res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = errorHandler;
