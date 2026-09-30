const { Router } = require('express');
const c = require('./habitaciones.controller');

const router = Router();

router.get('/', c.listar);
router.get('/disponibilidad', c.consultarDisponibilidad);
router.post('/', c.crear);
router.get('/:id', c.obtener);
router.patch('/:id/estado', c.cambiarEstado);

module.exports = router;