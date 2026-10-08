// Prueba independiente: no lee ni modifica la base indicada en .env.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');

const bin = process.env.PG_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/17/bin' : '');
const ejecutable = nombre => bin ? path.join(bin, nombre + (process.platform === 'win32' ? '.exe' : '')) : nombre;
const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'hotel-ingresos-test-'));
const datos = path.join(temporal, 'datos');
const entorno = { ...process.env, PGCLIENTENCODING: 'UTF8', PGPASSWORD: '', NODE_ENV: 'test', SMTP_HOST: '', MAIL_FROM: '' };
let iniciado = false;

function ejecutar(comando, argumentos, opciones = {}) {
  // pg_ctl puede heredar los pipes al servidor en Windows: usar archivos evita
  // que spawnSync espere a que termine el servidor después de haber arrancado.
  const salida = path.join(temporal, `${randomUUID()}.out`);
  const errores = path.join(temporal, `${randomUUID()}.err`);
  const out = fs.openSync(salida, 'w'); const err = fs.openSync(errores, 'w');
  let resultado;
  try { resultado = spawnSync(comando, argumentos, { cwd: path.resolve(__dirname, '..'), env: entorno,
    stdio: ['ignore', out, err], windowsHide: true, timeout: 60000, ...opciones }); }
  finally { fs.closeSync(out); fs.closeSync(err); }
  const textoSalida = fs.readFileSync(salida, 'utf8'); const textoErrores = fs.readFileSync(errores, 'utf8');
  if (resultado.error || resultado.status !== 0) throw new Error(resultado.error?.message || textoErrores || textoSalida || `Falló ${comando}`);
  return textoSalida;
}

(async () => {
  try {
    const puerto = await new Promise((resolve, reject) => {
      const servidor = net.createServer(); servidor.on('error', reject);
      servidor.listen(0, '127.0.0.1', () => { const puerto = servidor.address().port; servidor.close(() => resolve(puerto)); });
    });
    ejecutar(ejecutable('initdb'), ['-D', datos, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--locale=C']);
    iniciado = true;
    ejecutar(ejecutable('pg_ctl'), ['-D', datos, '-l', path.join(temporal, 'postgres.log'), '-o', `-p ${puerto} -h 127.0.0.1`, '-w', 'start']);
    const db = 'hotel_ingresos_test_validacion';
    const conexion = ['-X', '-w', '-h', '127.0.0.1', '-p', String(puerto), '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'];
    ejecutar(ejecutable('psql'), [...conexion, '-d', 'postgres', '-c', `CREATE DATABASE ${db}`]);
    ejecutar(ejecutable('psql'), [...conexion, '-d', db, '-f', path.resolve(__dirname, '../../database/instalar.sql')]);
    const url = `postgresql://postgres@127.0.0.1:${puerto}/${db}?schema=public`;
    console.log(ejecutar(process.execPath, ['--test', 'tests/ingresos.integration.test.js'], {
      env: { ...entorno, DATABASE_URL: url, TEST_INGRESOS_DATABASE_URL: url },
    }));
  } catch (error) {
    console.error(error.message); process.exitCode = 1;
  } finally {
    iniciado = iniciado && fs.existsSync(path.join(datos, 'postmaster.pid'));
    if (iniciado) {
      try { ejecutar(ejecutable('pg_ctl'), ['-D', datos, '-m', 'immediate', '-w', 'stop']); iniciado = false; }
      catch (error) { console.error('No se pudo detener la base de prueba:', error.message); process.exitCode = 1; }
    }
    const destino = path.resolve(temporal);
    const raiz = path.resolve(os.tmpdir()) + path.sep;
    if (!iniciado && destino.startsWith(raiz) && path.basename(destino).startsWith('hotel-ingresos-test-')) {
      fs.rmSync(destino, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      console.log('Base de prueba temporal eliminada.');
    }
  }
})();
