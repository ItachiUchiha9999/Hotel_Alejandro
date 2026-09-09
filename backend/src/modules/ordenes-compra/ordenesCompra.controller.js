const asyncHandler = require('../../utils/asyncHandler');

const service = require('./ordenesCompra.service');

const listar = asyncHandler(async (req, res) => {
  const data = await service.listar({
    supplierId: req.query.supplier_id,
    estado: req.query.estado,
    desde: req.query.desde,
    hasta: req.query.hasta,
  });

  res.json({
    ok: true,
    data,
  });
});

const obtener = asyncHandler(async (req, res) => {
  const data = await service.obtener(req.params.id);

  res.json({
    ok: true,
    data,
  });
});

const crear = asyncHandler(async (req, res) => {
  const data = await service.crear({
    ...req.body,

    // Más adelante, cuando tengan login real,
    // esto puede salir de req.user.employees_id.
    employees_id:
      req.body.employees_id ?? null,
  });

  res.status(201).json({
    ok: true,
    message: 'Orden de compra registrada.',
    data,
  });
});

const cambiarEstado = asyncHandler(async (req, res) => {
  const data = await service.cambiarEstado(
    req.params.id,
    {
      estado: req.body.estado,
      motivo: req.body.motivo,
      employees_id:
        req.body.employees_id ?? null,
    }
  );

  res.json({
    ok: true,
    message: 'Estado de la orden actualizado.',
    data,
  });
});

module.exports = {
  listar,
  obtener,
  crear,
  cambiarEstado,
};