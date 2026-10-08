const { Router } = require('express');
const controller = require('./reportes.controller');

const router = Router();

router.get('/ocupacion-temporadas', controller.obtenerOcupacionTemporadas);

module.exports = router;