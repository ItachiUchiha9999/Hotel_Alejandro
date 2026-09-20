const asyncHandler = require('../../utils/asyncHandler');
const service = require('./habitaciones.service');

const listar = asyncHandler(async (req, res) => {
  const data = await service.listar({
    tipo: req.query.tipo,
    estado: req.query.estado,
  });

  res.json({ ok: true, data });
});

const obtener = asyncHandler(async (req, res) => {
  const data = await service.obtener(req.params.id);

  res.json({ ok: true, data });
});

const crear = asyncHandler(async (req, res) => {
  const data = await service.crear(req.body);

  res.status(201).json({
    ok: true,
    message: `Habitación ${data.room_number} registrada como disponible.`,
    data,
  });
});

const cambiarEstado = asyncHandler(async (req, res) => {
  const data = await service.cambiarEstado(
    req.params.id,
    req.body.estado
  );

  res.json({
    ok: true,
    message: `Estado de la habitación actualizado a ${data.room_state}.`,
    data,
  });
});

module.exports = {
  listar,
  obtener,
  crear,
  cambiarEstado,
};