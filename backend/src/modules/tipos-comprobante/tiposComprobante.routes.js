const { Router } = require('express');
const controller = require('./tiposComprobante.controller');

/**
 * Catálogo de tipos de comprobante (PROV-02).
 * Por ahora solo lectura: el alta y la edición son parte de esa historia.
 */
const router = Router();

router.get('/', controller.listar);
router.get('/:id', controller.obtener);
router.post('/', controller.crear);
router.put('/:id', controller.actualizar);
router.patch('/:id/estado', controller.cambiarEstado);

module.exports = router;
