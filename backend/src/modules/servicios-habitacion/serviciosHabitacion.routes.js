const { Router } = require('express');
const controller = require('./serviciosHabitacion.controller');

const router = Router();
router.get('/catalogo/activos', controller.listarActivos);
router.get('/catalogo', controller.listarCatalogo);
router.post('/catalogo', controller.guardarCatalogo);
router.patch('/catalogo/:id', controller.actualizarCatalogo);
router.get('/catalogo/:id/precios', controller.historialPrecios);
router.get('/habitaciones-ocupadas', controller.habitacionesOcupadas);
router.get('/habitaciones/:roomId/cargos', controller.listarCargos);
router.post('/habitaciones/:roomId/cargos', controller.cargarCargo);
router.patch('/cargos/:id/cobrar', controller.cobrarCargo);

module.exports = router;
