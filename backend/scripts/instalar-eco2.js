require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const prisma = require('../src/db/prisma');
const sql = fs.readFileSync(path.resolve(__dirname, '../../database/18_reservas_web.sql'), 'utf8');
// Esta migración contiene únicamente sentencias DDL simples, sin cuerpos PL/pgSQL.
const statements = sql.replace(/^--.*$/gm, '').split(';').map(s => s.trim())
  .filter(s => s && !['BEGIN', 'COMMIT'].includes(s));
prisma.$transaction(async tx => {
  for (const statement of statements) await tx.$executeRawUnsafe(statement);
}).then(() => console.log('ECO-02: migración incremental aplicada.'))
  .catch(error => { console.error('No se pudo aplicar ECO-02:', error.code || error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
