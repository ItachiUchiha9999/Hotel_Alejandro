require('dotenv').config();

/**
 * Configuración centralizada. Es el ÚNICO lugar del backend que lee process.env,
 * así no hay valores por defecto contradictorios repartidos por el código.
 */
const env = {
  PORT: Number(process.env.PORT || 4000),
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV || 'development',

  /** Orígenes permitidos para CORS, separados por coma. */
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  /**
   * Empleado al que se le atribuyen los movimientos mientras no exista login
   * real (STK-06). Cuando lo haya, sale de req.user y esto deja de usarse.
   */
  DEFAULT_EMPLOYEE_ID: Number(process.env.DEFAULT_EMPLOYEE_ID || 1),
};

if (!env.DATABASE_URL) {
  console.error(
    '\n[config] Falta DATABASE_URL.\n' +
      'Copiá backend/.env.example a backend/.env y completá la cadena de conexión.\n'
  );
  process.exit(1);
}

module.exports = env;
