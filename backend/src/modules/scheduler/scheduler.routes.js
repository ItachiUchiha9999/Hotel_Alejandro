/**
 * Scheduler Routes - Endpoints para ejecutar tareas manualmente (solo admin/gerente)
 */

const { Router } = require('express');
const { autenticarYAutorizar } = require('../../middlewares/autenticacion');
const { ejecutarTodasLasTareas } = require('./scheduler.service');

const router = Router();

// Todas las rutas requieren autenticación y autorización (solo ADMIN/GERENTE tienen acceso a rutas no listadas)
router.use(autenticarYAutorizar);

/**
 * POST /api/scheduler/ejecutar
 * Ejecuta manualmente todas las tareas programadas
 * Útil para testing o si el job falló
 */
router.post('/ejecutar', async (req, res, next) => {
  try {
    const resultado = await ejecutarTodasLasTareas();
    res.json({
      ok: true,
      message: 'Tareas programadas ejecutadas correctamente',
      data: resultado
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/scheduler/estado
 * Devuelve el estado de los jobs programados (informativo)
 */
router.get('/estado', (req, res) => {
  res.json({
    ok: true,
    data: {
      jobs: [
        {
          nombre: 'procesar_no_shows_y_holds',
          frecuencia: 'Cada hora (minuto 0)',
          descripcion: 'Marca reservas como NO_SHOW y libera holds vencidos'
        },
        {
          nombre: 'activar_mantenimientos_programados',
          frecuencia: 'Diario a las 00:05',
          descripcion: 'Activa bloqueos de mantenimiento programados para hoy'
        }
      ]
    }
  });
});

module.exports = router;