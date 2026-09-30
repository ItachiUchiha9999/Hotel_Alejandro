const asyncHandler = require('../../utils/asyncHandler');
const service = require('./dashboard.service');

const finanzas = asyncHandler(async (req, res) => {
  const data = await service.consultarFinanzas({ periodo: req.query.periodo, fecha: req.query.fecha });
  res.json({ ok: true, data });
});

module.exports = { finanzas };
