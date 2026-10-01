const { Router } = require('express');
const controller = require('./tarifas.controller');

const router = Router();

router.get('/', controller.listar);
router.get('/historial', controller.listar);
router.post('/', controller.crear);
router.get('/:id', controller.obtener);
router.put('/:id', controller.actualizar);
router.patch('/:id/estado', controller.cambiarEstado);
router.get('/:id/cambios', controller.historial);

module.exports = router;
