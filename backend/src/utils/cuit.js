/**
 * Validación y normalización de CUIT (Argentina).
 * Formato de salida: XX-XXXXXXXX-X (siempre con guiones, sin importar cómo
 * lo haya tipeado el usuario) — así dos cargas del mismo proveedor con
 * "30711234568" y "30-71123456-8" no quedan como dos registros distintos.
 */

const MULTIPLICADORES = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** Deja solo los 11 dígitos, sin guiones ni espacios. */
function soloDigitos(cuit) {
  return String(cuit ?? '').replace(/\D/g, '');
}

/** Dígito verificador (algoritmo módulo 11) a partir de los primeros 10 dígitos. */
function digitoVerificador(digitos10) {
  const suma = MULTIPLICADORES.reduce((acc, m, i) => acc + m * Number(digitos10[i]), 0);
  const resultado = 11 - (suma % 11);
  if (resultado === 11) return 0;
  if (resultado === 10) return null; // no existe CUIT válido con este resultado
  return resultado;
}

/**
 * Valida formato + dígito verificador. Devuelve el CUIT normalizado con
 * guiones (XX-XXXXXXXX-X), o null si no es válido.
 */
function normalizarCuit(cuitCrudo) {
  const digitos = soloDigitos(cuitCrudo);
  if (digitos.length !== 11) return null;

  const dv = digitoVerificador(digitos.slice(0, 10));
  if (dv === null || dv !== Number(digitos[10])) return null;

  return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`;
}

module.exports = { normalizarCuit };