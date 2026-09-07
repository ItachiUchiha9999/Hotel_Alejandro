const { Router } = require('express');
const controller = require('./ordenesPago.controller');

const router = Router();

router.get('/metodos', controller.listarMetodosPago);

router.get(
  '/cuenta-corriente/:supplierId',
  controller.obtenerCuentaCorriente
);

router.get('/', controller.listar);
router.post('/', controller.crear);

router.get('/:id', controller.obtener);

router.post('/:id/detalles', controller.agregarDetalle);
router.post('/:id/confirmar', controller.confirmar);
router.post('/:id/resetear', controller.resetear);

module.exports = router;