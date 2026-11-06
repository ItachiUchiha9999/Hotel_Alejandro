const asyncHandler = require('../../utils/asyncHandler');
const service = require('./publico.service');
const reservaWeb = require('./reservaWeb.service');

const disponibilidad = asyncHandler(async (req, res) => {
  const data = await service.disponibilidad({
    desde: req.query.desde,
    hasta: req.query.hasta,
    huespedes: req.query.huespedes,
  });
  res.json({ ok: true, data });
});

const consultarReserva = asyncHandler(async (req, res) => {
  const data = await service.consultarReserva(req.body.codigo, req.body.documento);
  res.json({ ok: true, data });
});

const cancelarReserva = asyncHandler(async (req, res) => {
  const data = await service.cancelarReserva(req.params.codigo, req.body.documento);
  res.json({ ok: true, message: 'La reserva fue cancelada correctamente.', data });
});

const crearReserva = asyncHandler(async (req, res) => {
  const data = await reservaWeb.crearReservaWeb(req.body);
  res.status(201).json({ ok: true, data });
});

module.exports = { disponibilidad, consultarReserva, cancelarReserva, crearReserva };
