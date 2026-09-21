const { Router } = require('express');
const c = require('./housekeeping.controller');

/**
 * HU-9 (HAB-06) — /api/housekeeping
 *
 * Las rutas fijas van antes de /:id para que Express no tome "tablero" o
 * "resumen" como un identificador.
 */
const router = Router();

// Consultas
router.get('/tablero', c.tablero);
router.get('/resumen', c.resumen);
router.get('/habitaciones/:roomId/historial', c.historial);
router.get('/', c.listar);
router.get('/:id', c.obtener);

// Operaciones
router.post('/', c.abrir);
router.patch('/:id/finalizar', c.finalizar);
router.post('/habitaciones/:roomId/limpia', c.marcarLimpia);

module.exports = router;
