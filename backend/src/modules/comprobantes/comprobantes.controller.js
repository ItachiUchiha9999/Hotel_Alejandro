const asyncHandler = require('../../utils/asyncHandler');
const service = require('./comprobantes.service');

const listar = asyncHandler(async (req, res) => {
  const data = await service.listar({
    supplierId: req.query.proveedor,
    voucherTypeId: req.query.tipo,
    estado: req.query.estado,
    desde: req.query.desde,
    hasta: req.query.hasta,
  });
  res.json({ ok: true, data });
});

const obtener = asyncHandler(async (req, res) => {
  const data = await service.obtener(req.params.id);
  res.json({ ok: true, data });
});

const ordenesCompraAprobadas = asyncHandler(async (req, res) => {
  const data = await service.ordenesCompraAprobadas(req.params.supplierId);
  res.json({ ok: true, data });
});

const crear = asyncHandler(async (req, res) => {
  const data = await service.crear({
    ...req.body,
    // Cuando exista login (STK-06), acá va req.user.employees_id.
    employees_id: req.body.employees_id ?? null,
  });
  res.status(201).json({ ok: true, message: 'Comprobante registrado.', data });
});

module.exports = { listar, obtener, ordenesCompraAprobadas, crear };