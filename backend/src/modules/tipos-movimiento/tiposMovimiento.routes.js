const { Router } = require('express');
const c = require('./tiposMovimiento.controller');

const router = Router();

router.get('/', c.listar);
router.post('/', c.crear);
router.get('/:id', c.obtener);
router.put('/:id', c.actualizar);
router.patch('/:id/estado', c.cambiarEstado);
// Alias en inglés: es la ruta que usaba la pantalla de la rama STK-04.
router.patch('/:id/status', c.cambiarEstado);

module.exports = router;
