const { Router } = require('express');
const ArticuloController = require('../controllers/articulo.controller');

const router = Router();

router.post('/', ArticuloController.crear);
router.get('/', ArticuloController.listar);
router.get('/:id', ArticuloController.obtener);
router.put('/:id', ArticuloController.actualizar);
router.patch('/:id/estado', ArticuloController.cambiarEstado);

module.exports = router;