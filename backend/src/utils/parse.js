/** Entero positivo o null. Para IDs que pueden venir vacíos o mal formados. */
const toId = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Entero mayor a cero o null. La base exige amount > 0.
 * Antes aceptaba decimales (0.01, 1.5, etc.); el stock ahora se maneja
 * siempre en unidades enteras, así que un valor con decimales se rechaza
 * en vez de truncarse en silencio.
 */
const toPositive = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Entero >= 0 o null. Mismo criterio que toPositive: solo enteros.
 */
const toNonNegative = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
};

/** Texto recortado, o null si queda vacío. */
const toText = (value) => {
  const t = String(value ?? '').trim();
  return t.length ? t : null;
};

/** Interpreta 'true', 'Activo', 1, true... como booleano. */
const toBool = (value, porDefecto = null) => {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined || value === '') return porDefecto;
  const t = String(value).trim().toLowerCase();
  if (['true', '1', 'activo', 'si', 'sí'].includes(t)) return true;
  if (['false', '0', 'inactivo', 'no'].includes(t)) return false;
  return porDefecto;
};

module.exports = { toId, toPositive, toNonNegative, toText, toBool };