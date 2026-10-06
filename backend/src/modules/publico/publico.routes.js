const { Router } = require('express');
const controller = require('./publico.controller');

const router = Router();
router.get('/disponibilidad', controller.disponibilidad);
router.post('/reservas', controller.crearReserva);
router.post('/reservas/consultar', controller.consultarReserva);
router.post('/reservas/:codigo/cancelar', controller.cancelarReserva);

module.exports = router;
