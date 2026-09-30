const asyncHandler = require('../../utils/asyncHandler');
const env = require('../../config/env');
const service = require('./serviciosHabitacion.service');

const actor = (req) => req.user?.employees_id ?? req.get('x-employee-id')
  ?? req.body?.usuarioRecepcionId ?? req.body?.employees_id ?? req.body?.employeeId ?? env.DEFAULT_EMPLOYEE_ID ?? 1;

const listarCatalogo = asyncHandler(async (req, res) => {
  const data = await service.listarCatalogo({ incluirInactivos: req.query.todos !== 'false' });
  res.json({ ok: true, data });
});
const listarActivos = asyncHandler(async (_req, res) => res.json({ ok: true, data: await service.listarActivos() }));
const guardarCatalogo = asyncHandler(async (req, res) => {
  const data = await service.guardarCatalogo(req.body, actor(req));
  res.status(201).json({ ok: true, message: 'Servicio creado con precio inicial registrado.', data });
});
const actualizarCatalogo = asyncHandler(async (req, res) => {
  const data = await service.actualizarCatalogo(req.params.id, req.body, actor(req));
  res.json({ ok: true, message: 'Servicio y precio actualizados; se conserva el historial.', data });
});
const historialPrecios = asyncHandler(async (req, res) => res.json({ ok: true, data: await service.historialPrecios(req.params.id) }));
const habitacionesOcupadas = asyncHandler(async (_req, res) => res.json({ ok: true, data: await service.habitacionesOcupadas() }));
const listarCargos = asyncHandler(async (req, res) => res.json({
  ok: true,
  data: await service.listarCargos(req.params.roomId, req.query.reservationId),
}));
const cargarCargo = asyncHandler(async (req, res) => {
  const data = await service.cargarCargo(req.params.roomId, req.body, actor(req));
  res.status(201).json({ ok: true, message: `Cargo de ${data.service_name} agregado a la habitación.`, data });
});
const cobrarCargo = asyncHandler(async (req, res) => {
  const data = await service.cobrarCargo(req.params.id, req.body, actor(req));
  res.json({ ok: true, message: 'Cargo marcado como cobrado.', data });
});

module.exports = { listarCatalogo, listarActivos, guardarCatalogo, actualizarCatalogo, historialPrecios, habitacionesOcupadas, listarCargos, cargarCargo, cobrarCargo };
