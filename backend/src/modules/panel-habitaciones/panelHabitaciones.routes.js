const { Router } = require('express');
const controller = require('./panelHabitaciones.controller');

const router = Router();

router.get('/', controller.listar);

module.exports = router;