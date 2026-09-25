const asyncHandler = require('../../utils/asyncHandler');
const service = require('./mantenimiento.service');
const env = require('../../config/env');

const actor = (req, body = {}) =>
  req.user?.employees_id ??
  req.get('x-employee-id') ??
  body.employee_id ??
  body.employeeId ??
  env.DEFAULT_EMPLOYEE_ID ??
  1;

const registrar = asyncHandler(async (req, res) => {
  const data = await service.registrarBloqueo({
    roomId: req.body.roomId ?? req.body.room_id ?? req.params.roomId,
    tipo: req.body.tipo ?? req.body.maintenance_type,
    fechaInicio: req.body.fechaInicio ?? req.body.start_date,
    fechaFinEstimada: req.body.fechaFinEstimada ?? req.body.estimated_end_date,
    motivo: req.body.motivo ?? req.body.reason,
    employeeId: actor(req, req.body),
  });
  res.status(201).json({ ok: true, message: 'Habitación bloqueada correctamente.', data });
});

const cerrar = asyncHandler(async (req, res) => {
  const data = await service.cerrarBloqueo(req.params.id, {
    fechaFinReal: req.body.fechaFinReal ?? req.body.actual_end_date,
    notasCierre: req.body.notasCierre ?? req.body.closing_notes,
    employeeId: actor(req, req.body),
  });
  res.json({ ok: true, message: 'Mantenimiento cerrado. Habitación disponible.', data });
});

const listar = asyncHandler(async (req, res) => {
  const data = await service.listar({
    roomId: req.query.roomId ?? req.query.room_id,
    soloAbiertos: req.query.abiertos !== 'false',
  });
  res.json({ ok: true, data });
});

module.exports = { registrar, cerrar, listar };