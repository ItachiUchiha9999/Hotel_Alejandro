const asyncHandler = require('../../utils/asyncHandler');
const service = require('./metodosPago.service');

const listar = asyncHandler(async (req, res) => {
  const data = await service.listar({ soloActivos: req.query.activos === 'true' });
  res.json({ ok: true, data });
});

module.exports = { listar };