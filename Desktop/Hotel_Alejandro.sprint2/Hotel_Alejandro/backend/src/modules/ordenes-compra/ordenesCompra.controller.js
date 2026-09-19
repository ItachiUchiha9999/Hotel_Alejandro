const asyncHandler = require('../../utils/asyncHandler');
const ordenesCompraService = require('./ordenesCompra.service');

const listar = asyncHandler(async (req, res) => {
  const resultado =
    await ordenesCompraService.listar({
      supplierId:
        req.query.supplierId ??
        req.query.supplier_id,

      estado:
        req.query.estado ??
        req.query.status,

      desde:
        req.query.desde,

      hasta:
        req.query.hasta,

      page:
        req.query.page,

      limit:
        req.query.limit,
    });

  res.json({
    ok: true,
    data: resultado.data,
    pagination:
      resultado.pagination,
  });
});

const obtener = asyncHandler(async (req, res) => {
  const data =
    await ordenesCompraService.obtener(
      req.params.id
    );

  res.json({
    ok: true,
    data,
  });
});

const crear = asyncHandler(async (req, res) => {
  const data =
    await ordenesCompraService.crear(
      req.body
    );

  res.status(201).json({
    ok: true,
    message:
      'Orden de compra creada correctamente.',
    data,
  });
});

const editar = asyncHandler(async (req, res) => {
  const data =
    await ordenesCompraService.editar(
      req.params.id,
      req.body
    );

  res.json({
    ok: true,
    message:
      'Orden de compra actualizada correctamente.',
    data,
  });
});

const cambiarEstado = asyncHandler(
  async (req, res) => {
    const data =
      await ordenesCompraService.cambiarEstado(
        req.params.id,
        req.body
      );

    res.json({
      ok: true,
      message:
        'Estado de la orden actualizado correctamente.',
      data,
    });
  }
);

module.exports = {
  listar,
  obtener,
  crear,
  editar,
  cambiarEstado,
};