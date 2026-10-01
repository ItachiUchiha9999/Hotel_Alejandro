const asyncHandler = require('../../utils/asyncHandler');
const service = require('./tarifas.service');
const env = require('../../config/env');

const actor = (req, body = {}) =>
  req.user?.employees_id ??
  req.get('x-employee-id') ??
  body.employees_id ??
  body.employeeId ??
  env.DEFAULT_EMPLOYEE_ID ??
  1;

const listar = asyncHandler(async (req, res) => {
  const data = await service.listar({
    tipo: req.query.tipo ?? req.query.roomTypeId ?? req.query.room_type_id,
    soloVigentes:
      req.query.soloVigentes ??
      req.query.vigentes ??
      (req.query.estado === 'vigentes'),
  });

  res.json({
    ok: true,
    data,
  });
});

const obtener = asyncHandler(async (req, res) => {
  const data = await service.obtener(req.params.id);

  res.json({
    ok: true,
    data,
  });
});

const crear = asyncHandler(async (req, res) => {
  const empleadoId = actor(req, req.body);
  const data = await service.crear(req.body, empleadoId);

  res.status(201).json({
    ok: true,
    message: `Tarifa de ${data.room_type.room_type_name} registrada correctamente.`,
    data,
  });
});

const actualizar = asyncHandler(async (req, res) => {
  const data = await service.actualizar(req.params.id, req.body, actor(req, req.body));
  res.json({ ok: true, data, message: 'Tarifa actualizada correctamente.' });
});
const cambiarEstado = asyncHandler(async (req, res) => {
  if (typeof req.body.active !== 'boolean') {
    return res.status(400).json({ ok: false, message: 'Indicá el estado activo o inactivo.' });
  }
  const data = await service.actualizar(req.params.id, { active: req.body.active }, actor(req, req.body));
  res.json({ ok: true, data });
});
const historial = asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await service.historial(req.params.id) });
});

module.exports = {
  actualizar, cambiarEstado, historial,
  listar,
  obtener,
  crear,
};
