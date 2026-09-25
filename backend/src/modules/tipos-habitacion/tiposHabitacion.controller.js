const asyncHandler = require('../../utils/asyncHandler');
const service = require('./tiposHabitacion.service');
const env = require('../../config/env');

const actor = (req, body = {}) =>
  req.user?.employees_id ??
  req.get('x-employee-id') ??
  body.employee_id ??
  body.employeeId ??
  env.DEFAULT_EMPLOYEE_ID ??
  1;

const listar = asyncHandler(async (req, res) => {
  const data = await service.listar({
    estado: req.query.estado,
    soloActivos: req.query.activos === 'true',
  });
  res.json({ ok: true, data });
});

const obtener = asyncHandler(async (req, res) => {
  const data = await service.obtener(req.params.id);
  res.json({ ok: true, data });
});

const crear = asyncHandler(async (req, res) => {
  const data = await service.crear(req.body, actor(req, req.body));
  res.status(201).json({ ok: true, message: 'Tipo de habitación creado.', data });
});

const actualizar = asyncHandler(async (req, res) => {
  const data = await service.actualizar(req.params.id, req.body, actor(req, req.body));
  res.json({ ok: true, message: 'Tipo de habitación actualizado.', data });
});

const cambiarEstado = asyncHandler(async (req, res) => {
  const data = await service.cambiarEstado(
    req.params.id,
    req.body?.room_type_state ?? req.body?.estado
  );
  res.json({
    ok: true,
    message: data.room_type_state ? 'Tipo de habitación activado.' : 'Tipo de habitación desactivado.',
    data,
  });
});

const asignarTarifa = asyncHandler(async (req, res) => {
  const data = await service.asignarTarifa(req.params.id, {
    basePrice: req.body.basePrice ?? req.body.precioBase ?? req.body.base_price,
    reason: req.body.reason ?? req.body.motivo,
    employeeId: actor(req, req.body),
  });
  res.status(201).json({ ok: true, message: 'Tarifa base asignada correctamente.', data });
});

const historialTarifas = asyncHandler(async (req, res) => {
  const data = await service.historialTarifas(req.params.id);
  res.json({ ok: true, data });
});

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  cambiarEstado,
  asignarTarifa,
  historialTarifas,
};