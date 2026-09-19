const app = require('./app');
const env = require('./config/env');
const prisma = require('./db/prisma');

const server = app.listen(env.PORT, () => {
  console.log(`SIGH backend escuchando en http://localhost:${env.PORT}`);
  console.log(`Estado del servicio: http://localhost:${env.PORT}/api/health`);
});

/** Cierre ordenado: libera el pool de conexiones antes de salir. */
const apagar = async (senal) => {
  console.log(`\n${senal} recibido, cerrando...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
