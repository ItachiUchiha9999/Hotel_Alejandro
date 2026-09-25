/**
 * Reset de datos de prueba — Sistema Hotelero Alejandro.
 *
 * Borra: movimientos, detalle de movimientos, stock por depósito,
 *        artículos, categorías, depósitos.
 * Deja intacto: roles, employees, movement_type, suppliers.
 *
 * Uso (parado en backend/):
 *   node src/db/reset-datos-prueba.js
 */
require('dotenv').config();
const prisma = require('../db/prisma');

async function main() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      movement_stock_detail,
      stock_movement,
      articles_deposit_stock,
      articles,
      categories,
      deposit
    RESTART IDENTITY CASCADE;
  `);
  console.log('Listo: datos de prueba borrados (roles, empleados y tipos de movimiento quedaron intactos).');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());