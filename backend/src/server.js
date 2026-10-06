const app = require('./app');
const env = require('./config/env');
const prisma = require('./db/prisma');
const reservasService = require('./modules/reservas/reservas.service');
const { procesarCorreos } = require('./modules/publico/correoReserva.service');
let correoEnCurso = false;
const enviarPendientes = async () => {
  if (correoEnCurso) return;
  correoEnCurso = true;
  try { await procesarCorreos(); }
  catch (error) { console.error('[correo-reserva] No se pudo procesar la cola:', error.code || 'DB_ERROR'); }
  finally { correoEnCurso = false; }
};
enviarPendientes();
const jobCorreos = setInterval(enviarPendientes, 10000);
jobCorreos.unref();

const expirarPendientes = () => reservasService.expirarPendientes().catch((error) => {
  console.error('No se pudieron liberar las reservas pendientes vencidas:', error.message);
});
expirarPendientes();
const jobExpiracionReservas = setInterval(expirarPendientes, 60 * 1000);
jobExpiracionReservas.unref();

const server = app.listen(env.PORT, () => {
  console.log(`SIGH backend escuchando en http://localhost:${env.PORT}`);
  console.log(`Estado del servicio: http://localhost:${env.PORT}/api/health`);
});

/** Cierre ordenado: libera el pool de conexiones antes de salir. */
const apagar = async (senal) => {
  console.log(`\n${senal} recibido, cerrando...`);
  clearInterval(jobExpiracionReservas);
  clearInterval(jobCorreos);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
