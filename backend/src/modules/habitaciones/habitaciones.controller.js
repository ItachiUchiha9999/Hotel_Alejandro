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

const consultarDisponibilidad = asyncHandler(async (req, res) => {
  const data = await service.consultarDisponibilidad({
    desde: req.query.desde,
    hasta: req.query.hasta,
    capacidad: req.query.capacidad,
    tipo: req.query.tipo,
  });

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
  consultarDisponibilidad,
  crear,
  cambiarEstado,
};