const asyncHandler = require('../../utils/asyncHandler');
const service = require('./comprobantes.service');

const listar = asyncHandler(async (req, res) => {
  const data = await service.listar({ supplierId: req.query.proveedor });
  res.json({ ok: true, data });
});

const obtener = asyncHandler(async (req, res) => {
  const data = await service.obtener(req.params.id);
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

module.exports = { listar, obtener, crear };
