const { Router } = require('express');
const c = require('./ordenesPago.controller');

const router = Router();

router.get('/', c.listar);
router.post('/', c.crear);
router.get('/pendientes/:supplierId', c.comprobantesPendientes);
router.get('/:id', c.obtener);

// Soportar tanto /detalle como /detalles
router.post('/:id/detalle', c.agregarDetalle);
router.post('/:id/detalles', c.agregarDetalle);
router.delete('/:id/detalle/:detalleId', c.quitarDetalle);
router.delete('/:id/detalles/:detalleId', c.quitarDetalle);

// Soportar tanto POST como PATCH para confirmar
router.post('/:id/confirmar', c.confirmar);
router.patch('/:id/confirmar', c.confirmar);

module.exports = router;