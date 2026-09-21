const asyncHandler = require('../../utils/asyncHandler');
const service = require('./housekeeping.service');

const tablero = asyncHandler(async (req, res) => {
  const data = await service.getTablero({ estado: req.query.estado });
  res.json({ ok: true, data });
});

const resumen = asyncHandler(async (_req, res) => {
  const data = await service.getResumen();
  res.json({ ok: true, data });
});

const listar = asyncHandler(async (req, res) => {
  const data = await service.listar({
    habitacion: req.query.habitacion,
    abiertos: req.query.abiertos,
    tipo: req.query.tipo,
  });
  res.json({ ok: true, data });
});

const obtener = asyncHandler(async (req, res) => {
  const data = await service.obtener(req.params.id);
  res.json({ ok: true, data });
});

const historial = asyncHandler(async (req, res) => {
  const data = await service.historial(req.params.roomId);
  res.json({ ok: true, data });
});

const abrir = asyncHandler(async (req, res) => {
  const data = await service.abrir({
    ...req.body,
    // Cuando exista el login real, acá va req.user.employees_id.
    employees_id: req.body.employees_id ?? null,
  });
  res.status(201).json({ ok: true, message: 'Bloqueo registrado.', data });
});

const finalizar = asyncHandler(async (req, res) => {
  const data = await service.finalizar(req.params.id, {
    ...req.body,
    employees_id: req.body?.employees_id ?? null,
  });
  res.json({
    ok: true,
    message: data.se_atraso
      ? 'Bloqueo finalizado con demora respecto de lo estimado.'
      : 'Bloqueo finalizado. La habitación volvió a estar disponible.',
    data,
  });
});

const marcarLimpia = asyncHandler(async (req, res) => {
  const data = await service.marcarLimpia(req.params.roomId, {
    ...req.body,
    employees_id: req.body?.employees_id ?? null,
  });
  res.json({ ok: true, message: `Habitación ${data.room_number} lista para vender.`, data });
});

module.exports = { tablero, resumen, listar, obtener, historial, abrir, finalizar, marcarLimpia };
