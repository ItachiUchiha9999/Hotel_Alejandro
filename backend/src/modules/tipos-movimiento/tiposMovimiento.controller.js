const asyncHandler = require('../../utils/asyncHandler');
const service = require('./tiposMovimiento.service');

const listar = asyncHandler(async (req, res) => {
  const data = await service.listar({ soloActivos: req.query.activos === 'true' });
  res.json({ ok: true, data });
});

const obtener = asyncHandler(async (req, res) => {
  const data = await service.obtener(req.params.id);
  res.json({ ok: true, data });
});

const crear = asyncHandler(async (req, res) => {
  const data = await service.crear(req.body);
  res.status(201).json({ ok: true, message: 'Tipo de movimiento creado.', data });
});

const actualizar = asyncHandler(async (req, res) => {
  const data = await service.actualizar(req.params.id, req.body);
  res.json({ ok: true, message: 'Tipo de movimiento actualizado.', data });
});

const cambiarEstado = asyncHandler(async (req, res) => {
  const data = await service.cambiarEstado(
    req.params.id,
    req.body?.active ?? req.body?.estado
  );
  res.json({
    ok: true,
    message: data.active ? 'Tipo activado.' : 'Tipo desactivado.',
    data,
  });
});

module.exports = { listar, obtener, crear, actualizar, cambiarEstado };
