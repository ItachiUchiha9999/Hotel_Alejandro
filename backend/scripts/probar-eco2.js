// Ejecuta la integración sobre una base nueva y desechable, nunca sobre datos locales.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const admin = new PrismaClient();
const url = new URL(process.env.DATABASE_URL);
const nombre = `hotel_eco2_test_${randomUUID().replaceAll('-', '')}`;
const psql = process.env.PSQL_PATH || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/17/bin/psql.exe' : 'psql');
async function main() {
  let creada = false;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${nombre}"`);
    creada = true;
    const result = spawnSync(psql, ['-X', '-v', 'ON_ERROR_STOP=1', '-h', url.hostname, '-p', url.port || '5432',
      '-U', decodeURIComponent(url.username), '-d', nombre, '-f', path.resolve(__dirname, '../../database/instalar.sql')],
    { env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password), PGCLIENTENCODING: 'UTF8' }, encoding: 'utf8', windowsHide: true });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(result.stderr);
    url.pathname = `/${nombre}`;
    const tests = spawnSync(process.execPath, ['--test', 'tests/reserva-web.integration.test.js'], {
      cwd: path.resolve(__dirname, '..'), env: { ...process.env, TEST_DATABASE_URL: url.toString() }, stdio: 'inherit', windowsHide: true,
    });
    if (tests.error) throw tests.error;
    process.exitCode = tests.status || 0;
  } finally {
    if (creada) await admin.$executeRawUnsafe(`DROP DATABASE "${nombre}" WITH (FORCE)`);
    await admin.$disconnect();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
