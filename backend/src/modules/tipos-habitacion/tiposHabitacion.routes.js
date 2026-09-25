const { Router } = require('express');
const c = require('./tiposHabitacion.controller');

const router = Router();

router.get('/', c.listar);
router.post('/', c.crear);
router.get('/:id', c.obtener);
router.put('/:id', c.actualizar);
router.patch('/:id/estado', c.cambiarEstado);

// TAR-01
router.post('/:id/tarifa', c.asignarTarifa);
router.get('/:id/tarifas/historial', c.historialTarifas);

module.exports = router;