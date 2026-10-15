const asyncHandler = require('../../utils/asyncHandler');
const service = require('./auth.service');

const iniciarSesion = asyncHandler(async (req, res) => {
  const data = await service.iniciarSesion(req.body.usuario, req.body.contrasena);
  res.json({ ok: true, data, message: 'Sesión iniciada.' });
});

const sesionActual = asyncHandler(async (req, res) => {
  res.json({ ok: true, data: req.user, message: 'Sesión vigente.' });
});

module.exports = { iniciarSesion, sesionActual };
