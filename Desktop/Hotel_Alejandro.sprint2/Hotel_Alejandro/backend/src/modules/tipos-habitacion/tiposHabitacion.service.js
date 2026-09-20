const prisma = require('../../db/prisma');
const { noEncontrado, conflicto, invalido } = require('../../utils/AppError');
const { toId, toText, toPositive, toBool } = require('../../utils/parse');

/**
 * Catálogo de tipos de habitación (HAB-03).
 *
 * Un tipo inactivo deja de ofrecerse al registrar habitaciones nuevas (HAB-01),
 * pero las habitaciones que ya lo tienen asignado siguen existiendo: es una baja
 * lógica, igual que en depósitos, artículos y tipos de movimiento.
 */

const NOMBRE_MAX = 60;
const DESCRIPCION_MAX = 255;
/** Mismo tope que el CHECK ck_room_type_capacity de la base. */
const CAPACIDAD_MAX = 20;

/** Trae la cantidad de habitaciones de cada tipo, que la pantalla muestra en la tabla. */
const CON_CONTEO = { _count: { select: { room: true } } };

/** Aplana el conteo de Prisma a la forma que espera el frontend (TipoHabitacion). */
const presentar = ({ _count, ...tipo }) => ({ ...tipo, rooms_count: _count.room });

/** Valida y normaliza los tres datos editables de un tipo. */
const leerDatos = (datos = {}) => {
  const nombre = toText(datos.room_type_name ?? datos.nombre)?.replace(/\s+/g, ' ');
  const descripcion = toText(datos.room_type_description ?? datos.descripcion);
  const capacidad = toPositive(datos.room_type_max_capacity ?? datos.capacidad);

  if (!nombre) throw invalido('El nombre del tipo de habitación es obligatorio.');
  if (nombre.length < 2) throw invalido('El nombre tiene que tener al menos 2 caracteres.');
  if (nombre.length > NOMBRE_MAX) {
    throw invalido(`El nombre no puede superar los ${NOMBRE_MAX} caracteres.`);
  }
  if (descripcion && descripcion.length > DESCRIPCION_MAX) {
    throw invalido(`La descripción no puede superar los ${DESCRIPCION_MAX} caracteres.`);
  }
  if (!capacidad || capacidad > CAPACIDAD_MAX) {
    throw invalido(
      `La capacidad máxima tiene que ser un número entero entre 1 y ${CAPACIDAD_MAX}.`
    );
  }

  return { nombre, descripcion, capacidad };
};

/** "Suite" y "suite" son el mismo tipo: se compara sin distinguir mayúsculas. */
const verificarNombreLibre = async (nombre, ignorarId = null) => {
  const existente = await prisma.room_type.findFirst({
    where: {
      room_type_name: { equals: nombre, mode: 'insensitive' },
      ...(ignorarId ? { NOT: { room_type_id: ignorarId } } : {}),
    },
    select: { room_type_id: true },
  });

  if (existente) {
    throw conflicto('Ya existe un tipo de habitación con ese nombre. Elegí otro.');
  }
};

const listar = async ({ soloActivos = false } = {}) => {
  const tipos = await prisma.room_type.findMany({
    where: soloActivos ? { room_type_state: true } : undefined,
    include: CON_CONTEO,
    orderBy: { room_type_id: 'asc' },
  });
  return tipos.map(presentar);
};

const obtener = async (id) => {
  const tipoId = toId(id);
  if (!tipoId) throw invalido('El identificador del tipo de habitación no es válido.');

  const tipo = await prisma.room_type.findUnique({
    where: { room_type_id: tipoId },
    include: CON_CONTEO,
  });
  if (!tipo) throw noEncontrado('El tipo de habitación no existe.');
  return presentar(tipo);
};

const crear = async (datos = {}) => {
  const { nombre, descripcion, capacidad } = leerDatos(datos);
  await verificarNombreLibre(nombre);

  const tipo = await prisma.room_type.create({
    data: {
      room_type_name: nombre,
      room_type_description: descripcion,
      room_type_max_capacity: capacidad,
      room_type_state: toBool(datos.room_type_state ?? datos.estado, true),
    },
    include: CON_CONTEO,
  });
  return presentar(tipo);
};

const actualizar = async (id, datos = {}) => {
  const actual = await obtener(id);
  const { nombre, descripcion, capacidad } = leerDatos(datos);
  await verificarNombreLibre(nombre, actual.room_type_id);

  const tipo = await prisma.room_type.update({
    where: { room_type_id: actual.room_type_id },
    data: {
      room_type_name: nombre,
      room_type_description: descripcion,
      room_type_max_capacity: capacidad,
      // Si el formulario no manda el estado, se conserva el que ya tenía.
      room_type_state: toBool(datos.room_type_state ?? datos.estado, actual.room_type_state),
    },
    include: CON_CONTEO,
  });
  return presentar(tipo);
};

/** Baja lógica: activa o desactiva. Sin valor explícito, invierte el estado actual. */
const cambiarEstado = async (id, estado) => {
  const actual = await obtener(id);
  const activo = toBool(estado, !actual.room_type_state);

  const tipo = await prisma.room_type.update({
    where: { room_type_id: actual.room_type_id },
    data: { room_type_state: activo },
    include: CON_CONTEO,
  });
  return presentar(tipo);
};

module.exports = { listar, obtener, crear, actualizar, cambiarEstado };
