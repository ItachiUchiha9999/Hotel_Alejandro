const asyncHandler = require('../../utils/asyncHandler');
const service = require('./reservas.service');

const actor = (req, body = {}) =>
  req.user?.employees_id ?? req.get('x-employee-id') ?? body.usuarioRecepcionId ?? body.employee_id;

const crear = asyncHandler(async (req, res) => {
  const data = await service.crear({
    guestId: req.body.clienteId ?? req.body.guestId ?? req.body.guest_id,
    roomId: req.body.habitacionId ?? req.body.room_id,
    checkIn: req.body.fechaIngreso ?? req.body.check_in,
    checkOut: req.body.fechaEgreso ?? req.body.check_out,
    status: req.body.estadoInicial ?? req.body.status,
    employeeId: actor(req, req.body),
  });
  res.status(201).json({ ok: true, message: 'Reserva registrada correctamente.', data });
});

const modificar = asyncHandler(async (req, res) => {
  const data = await service.modificar(req.params.id, req.body, actor(req, req.body));
  res.json({ ok: true, message: 'Reserva modificada correctamente.', data });
});

const cancelar = asyncHandler(async (req, res) => {
  const data = await service.cancelar(req.params.id, req.body.reason, actor(req, req.body));
  res.json({ ok: true, message: 'Reserva cancelada correctamente.', data });
});

const catalogos = asyncHandler(async (_req, res) => {
  const data = await service.catalogos();
  res.json({ ok: true, data });
});

const clientes = asyncHandler(async (_req, res) => {
  const data = await service.listarHuespedes();
  res.json({ ok: true, data });
});

const habitaciones = asyncHandler(async (_req, res) => {
  const data = await service.listarHabitaciones();
  res.json({ ok: true, data });
});

const crearHold = asyncHandler(async (req, res) => {
  const data = await service.crearHold({ ...req.body, employeeId: actor(req, req.body) });
  res.status(201).json({ ok: true, data });
});

const liberarHold = asyncHandler(async (req, res) => {
  const data = await service.liberarHold(req.params.id, actor(req, req.body));
  res.json({ ok: true, data });
});

const listar = asyncHandler(async (req, res) => {
  const data = await service.listar({
    estado: req.query.estado,
    roomId: req.query.habitacion ?? req.query.room_id,
    desde: req.query.desde,
    hasta: req.query.hasta,
  });
  res.json({ ok: true, data });
});

const obtener = asyncHandler(async (req, res) => {
  const data = await service.obtener(req.params.id);
  res.json({ ok: true, data });
});

const checkIn = asyncHandler(async (req, res) => {
  const data = await service.checkIn(req.params.id, {
    employeeId: actor(req, req.body),
    actualAdults: req.body.adultosReales ?? req.body.actual_adults,
    actualChildren: req.body.menoresReales ?? req.body.actual_children,
    observations: req.body.observaciones ?? req.body.observations,
  });
  res.json({ ok: true, message: `Check-in registrado. Habitación ${data.room.room_number} ocupada.`, data });
});

const checkOut = asyncHandler(async (req, res) => {
  const conSaldoPendiente = req.body.saldoPendiente ?? req.body.pending_charges;
  const data = await service.checkOut(req.params.id, {
    employeeId: actor(req, req.body),
    pendingCharges: conSaldoPendiente,
    pendingDetail: req.body.detalleSaldo ?? req.body.pending_detail,
    observations: req.body.observaciones ?? req.body.observations,
  });
  const message = conSaldoPendiente
    ? 'Check-out registrado. Atención: la estadía quedó con saldo pendiente de facturar/cobrar.'
    : 'Check-out registrado correctamente.';
  res.json({ ok: true, message, data });
});

const barrerNoShows = asyncHandler(async (_req, res) => {
  const data = await service.barrerNoShows();
  res.json({ ok: true, message: `${data.marcadas} reserva(s) marcada(s) como No-show.`, data });
});

module.exports = {
  crear, modificar, cancelar, catalogos, clientes, habitaciones, crearHold, liberarHold,
  listar, obtener, checkIn, checkOut, barrerNoShows,
};