const { Router } = require('express');

const controller = require('./tarifas.controller');

const router = Router();

router.get('/', controller.listar);

router.post('/', controller.crear);

router.get('/:id', controller.obtener);

module.exports = router;