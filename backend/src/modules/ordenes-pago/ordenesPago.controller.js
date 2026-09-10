const asyncHandler = require('../../utils/asyncHandler');
const service = require('./ordenesPago.service');

const listar = asyncHandler(async (req, res) => {
  const data = await service.listar({ supplierId: req.query.proveedor });
  res.json({ ok: true, data });
});

const obtener = asyncHandler(async (req, res) => {
  const data = await service.obtener(req.params.id);
  res.json({ ok: true, data });
});

const comprobantesPendientes = asyncHandler(async (req, res) => {
  const data = await service.comprobantesPendientes(req.params.supplierId);
  res.json({ ok: true, data });
});

const crear = asyncHandler(async (req, res) => {
  const data = await service.crear(req.body);
  res.status(201).json({ ok: true, message: 'Orden de pago creada en borrador.', data });
});

const agregarDetalle = asyncHandler(async (req, res) => {
  const data = await service.agregarDetalle(req.params.id, req.body);
  res.json({ ok: true, message: 'Comprobante agregado a la orden.', data });
});

const quitarDetalle = asyncHandler(async (req, res) => {
  const data = await service.quitarDetalle(req.params.id, req.params.detalleId);
  res.json({ ok: true, message: 'Comprobante quitado de la orden.', data });
});

const confirmar = asyncHandler(async (req, res) => {
  const data = await service.confirmar(req.params.id);
  res.json({ ok: true, message: 'Orden de pago confirmada. Saldos actualizados.', data });
});

module.exports = { listar, obtener, comprobantesPendientes, crear, agregarDetalle, quitarDetalle, confirmar };