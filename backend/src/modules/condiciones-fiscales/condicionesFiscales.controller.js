const asyncHandler = require('../../utils/asyncHandler');
const service = require('./condicionesFiscales.service');

const listar = asyncHandler(async (req, res) => {
  const data = await service.listar({ soloActivas: req.query.activas === 'true' });
  res.json({ ok: true, data });
});

module.exports = { listar };