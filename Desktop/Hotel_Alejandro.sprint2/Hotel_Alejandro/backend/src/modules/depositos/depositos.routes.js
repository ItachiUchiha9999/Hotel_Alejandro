const { Router } = require('express');
const c = require('./depositos.controller');

const router = Router();

router.get('/', c.listar);
router.post('/', c.crear);
router.get('/:id', c.obtener);
router.put('/:id', c.actualizar);
// POST /:id se mantiene porque la pantalla de edición ya lo usaba así.
router.post('/:id', c.actualizar);
router.patch('/:id/estado', c.cambiarEstado);

module.exports = router;
