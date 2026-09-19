const asyncHandler = require('../../utils/asyncHandler');
const service = require('./habitaciones.service');

const listar = asyncHandler(async (req, res) => {
  const data = await service.listar();
  res.json({ ok: true, data });
});

const obtener = asyncHandler(async (req, res) => {
  const data = await service.obtener(req.params.id);
  res.json({ ok: true, data });
});

const crear = asyncHandler(async (req, res) => {
  const data = await service.crear(req.body);
  res.status(201).json({ ok: true, message: 'Habitación registrada.', data });
});

const actualizar = asyncHandler(async (req, res) => {
  const data = await service.actualizar(req.params.id, req.body);
  res.json({ ok: true, message: 'Habitación actualizada.', data });
});

module.exports = { listar, obtener, crear, actualizar };
