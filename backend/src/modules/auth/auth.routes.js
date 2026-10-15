const { Router } = require('express');
const controller = require('./auth.controller');
const { autenticar } = require('../../middlewares/autenticacion');

const router = Router();
router.post('/login', controller.iniciarSesion);
router.get('/me', autenticar, controller.sesionActual);

module.exports = router;
