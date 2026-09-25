const asyncHandler = require('../../utils/asyncHandler');
const service = require('./cuentaCorriente.service');

const obtener = asyncHandler(async (req, res) => {
  const data = await service.obtenerCuenta(req.params.supplierId, {
    paymentMethodId: req.query.formaPago,
    desde: req.query.desde,
    hasta: req.query.hasta,
  });
  res.json({ ok: true, data });
});

module.exports = { obtener };