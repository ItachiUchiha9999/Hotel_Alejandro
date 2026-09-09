const { Router } = require('express');

const controller = require('./ordenesCompra.controller');

const router = Router();

router.get('/', controller.listar);

router.get('/:id', controller.obtener);

router.post('/', controller.crear);

router.patch('/:id/estado', controller.cambiarEstado);

module.exports = router;