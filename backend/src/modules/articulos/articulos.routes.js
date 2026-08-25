const { Router } = require('express');
const c = require('./articulos.controller');

const router = Router();

router.get('/', c.listar);
router.post('/', c.crear);
router.get('/:id', c.obtener);
router.put('/:id', c.actualizar);
router.patch('/:id/estado', c.cambiarEstado);

module.exports = router;
