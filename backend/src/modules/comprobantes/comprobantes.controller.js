const asyncHandler = require('../../utils/asyncHandler');

const service = require('./comprobantes.service');

const listar = asyncHandler(async (req, res) => {
  const data = await service.listar({
    supplierId:
      req.query.proveedor ??
      req.query.supplier_id,

    voucherTypeId:
      req.query.tipo,

    estado:
      req.query.estado,

    desde:
      req.query.desde,

    hasta:
      req.query.hasta,

    payable:
      req.query.payable === 'true',
  });

  res.json({
    ok: true,
    data,
  });
});

const obtener = asyncHandler(async (req, res) => {
  const data = await service.obtener(
    req.params.id
  );

  res.json({
    ok: true,
    data,
  });
});

const crear = asyncHandler(async (req, res) => {
  const data = await service.crear({
    ...req.body,

    employees_id:
      req.body.employees_id ?? null,
  });

  res.status(201).json({
    ok: true,
    message: 'Comprobante registrado.',
    data,
  });
});

module.exports = {
  listar,
  obtener,
  crear,
};