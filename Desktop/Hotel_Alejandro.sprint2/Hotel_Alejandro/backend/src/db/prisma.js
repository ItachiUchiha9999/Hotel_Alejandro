const { PrismaClient } = require('@prisma/client');
const env = require('../config/env');

/**
 * Cliente Prisma único para toda la aplicación.
 * Antes había dos módulos duplicados (db/prisma.js y utils/prisma.js), lo que
 * abría dos pools de conexiones contra la misma base.
 */
const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
