const { Router } = require('express');
const c = require('./articulos.controller');

const router = Router();

// Va antes de /:id para que Express no confunda "siguiente-codigo" con un id.
router.get('/siguiente-codigo/:categoriaId', c.siguienteCodigo);

router.get('/', c.listar);
router.post('/', c.crear);
router.get('/:id', c.obtener);
router.put('/:id', c.actualizar);
router.patch('/:id/estado', c.cambiarEstado);

module.exports = router;