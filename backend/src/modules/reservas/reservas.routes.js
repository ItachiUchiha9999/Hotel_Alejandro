const { Router } = require('express');
const controller = require('./reservas.controller');

const router = Router();

router.get('/catalogos', controller.catalogos);
router.get('/clientes', controller.clientes);
router.get('/habitaciones', controller.habitaciones);
router.post('/holds', controller.crearHold);
router.patch('/holds/:id/liberar', controller.liberarHold);
router.post('/no-show/barrido', controller.barrerNoShows); // utilitario: listo para un scheduler futuro
router.get('/', controller.listar);
router.post('/', controller.crear);
router.get('/:id', controller.obtener);
router.patch('/:id', controller.modificar);
router.post('/:id/cancelar', controller.cancelar);
router.post('/:id/checkin', controller.checkIn);
router.post('/:id/checkout', controller.checkOut);

module.exports = router;