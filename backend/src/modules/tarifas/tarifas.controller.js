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

module.exports = {
  listar,
  obtener,
  crear,
};