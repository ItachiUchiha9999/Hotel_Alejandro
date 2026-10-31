/**
 * Scheduler Service - Ejecuta tareas periódicas de base de datos
 *
 * Funciones diarias que deben ejecutarse automáticamente:
 * - fn_process_no_shows(): marca reservas como NO_SHOW y libera habitaciones
 * - fn_activate_scheduled_maintenance(): activa bloqueos de mantenimiento programados para hoy
 * - fn_release_expired_holds(): libera retenciones (holds) vencidas
 */

const prisma = require('../../db/prisma');
const cron = require('node-cron');

/**
 * Ejecuta fn_process_no_shows() y fn_release_expired_holds()
 * Se ejecuta cada hora para detectar no-shows según NO_SHOW_HOURS (default 24h)
 */
async function procesarNoShowsYHolds() {
  try {
    const [noShows, holds] = await Promise.all([
      prisma.$queryRaw`SELECT fn_process_no_shows() as afectadas`,
      prisma.$queryRaw`SELECT fn_release_expired_holds() as liberadas`
    ]);

    const noShowCount = noShows[0]?.afectadas ?? 0;
    const holdsCount = holds[0]?.liberadas ?? 0;

    if (noShowCount > 0 || holdsCount > 0) {
      console.log(`[Scheduler] NO_SHOW procesados: ${noShowCount}, Holds liberados: ${holdsCount}`);
    }

    return { noShows: noShowCount, holds: holdsCount };
  } catch (error) {
    console.error('[Scheduler] Error procesando no-shows y holds:', error.message);
    throw error;
  }
}

/**
 * Ejecuta fn_activate_scheduled_maintenance()
 * Se ejecuta una vez al día a medianoche (00:05) para activar mantenimientos programados para hoy
 */
async function activarMantenimientosProgramados() {
  try {
    const result = await prisma.$queryRaw`SELECT fn_activate_scheduled_maintenance() as afectadas`;
    const count = result[0]?.afectadas ?? 0;

    if (count > 0) {
      console.log(`[Scheduler] Mantenimientos programados activados: ${count} habitaciones`);
    }

    return { activadas: count };
  } catch (error) {
    console.error('[Scheduler] Error activando mantenimientos programados:', error.message);
    throw error;
  }
}

/**
 * Inicializa todos los jobs programados
 */
function inicializarScheduler() {
  // Cada hora: procesar no-shows y liberar holds vencidos
  cron.schedule('0 * * * *', async () => {
    console.log('[Scheduler] Ejecutando job horario: no-shows y holds');
    await procesarNoShowsYHolds().catch(() => {}); // Error ya logueado en la función
  });

  // Cada día a las 00:05: activar mantenimientos programados para hoy
  cron.schedule('5 0 * * *', async () => {
    console.log('[Scheduler] Ejecutando job diario: activar mantenimientos programados');
    await activarMantenimientosProgramados().catch(() => {});
  });

  console.log('[Scheduler] Jobs programados inicializados:');
  console.log('  - Cada hora (minuto 0): procesar no-shows y holds');
  console.log('  - Diario 00:05: activar mantenimientos programados');
}

/**
 * Ejecuta manualmente todas las tareas (útil para testing o endpoint admin)
 */
async function ejecutarTodasLasTareas() {
  const [noShows, mantenimientos] = await Promise.all([
    procesarNoShowsYHolds(),
    activarMantenimientosProgramados()
  ]);

  return {
    noShows: noShows.noShows,
    holds: noShows.holds,
    mantenimientos: mantenimientos.activadas
  };
}

module.exports = {
  inicializarScheduler,
  ejecutarTodasLasTareas,
  procesarNoShowsYHolds,
  activarMantenimientosProgramados
};