const prisma = require('../../db/prisma');
const { noEncontrado, conflicto, invalido } = require('../../utils/AppError');
const { toId, toText, toBool, toPositive } = require('../../utils/parse');

/**
 * Tipos de habitación (HAB-03).
 *
 * Reglas del backlog:
 *  - Se pueden crear, editar y cambiar de estado (Activo/Inactivo).
 *  - La capacidad máxima tiene que ser mayor a cero.
 *  - No se puede eliminar un tipo que tenga habitaciones asociadas.
 */

const NOMBRE_MAX = 50;
const DESCRIPCION_MAX = 255;

const CON_CONTEO = { _count: { select: { room: true } } };

/** Aplana el _count de Prisma a un campo simple que el frontend pueda leer. */
const presentar = ({ _count, ...tipo }) => ({ ...tipo, rooms_count: _count.room });

const listar = async ({ soloActivos = false } = {}) => {
  const tipos = await prisma.room_type.findMany({
    where: soloActivos ? { room_type_state: true } : undefined,
    include: CON_CONTEO,
    orderBy: { room_type_name: 'asc' },
  });
  return tipos.map(presentar);
};

const obtener = async (id) => {
  const typeId = toId(id);
  if (!typeId) throw invalido('El identificador del tipo de habitación no es válido.');

  const tipo = await prisma.room_type.findUnique({
    where: { room_type_id: typeId },
    include: CON_CONTEO,
  });
  if (!tipo) throw noEncontrado('El tipo de habitación no existe.');
  return tipo;
};

/** Valida y normaliza los campos comunes a alta y edición. */
const leerCampos = (datos = {}) => {
  const nombre = toText(datos.room_type_name ?? datos.nombre);
  if (!nombre) throw invalido('El nombre del tipo de habitación es obligatorio.');
  if (nombre.length > NOMBRE_MAX) {
    throw invalido(`El nombre admite hasta ${NOMBRE_MAX} caracteres.`);
  }

  const descripcion = toText(datos.room_type_description ?? datos.descripcion);
  if (descripcion && descripcion.length > DESCRIPCION_MAX) {
    throw invalido(`La descripción admite hasta ${DESCRIPCION_MAX} caracteres.`);
  }

  // toPositive rechaza decimales, texto y cero: "capacidad mayor a cero".
  const capacidad = toPositive(datos.room_type_max_capacity ?? datos.capacidad_maxima);
  if (!capacidad) {
    throw invalido('La capacidad máxima debe ser un número entero mayor a cero.');
  }

  return { nombre, descripcion, capacidad };
};

/** El nombre no distingue mayúsculas: "suite" y "Suite" son el mismo tipo. */
const validarNombreLibre = async (nombre, excluirId) => {
  const repetido = await prisma.room_type.findFirst({
    where: {
      room_type_name: { equals: nombre, mode: 'insensitive' },
      ...(excluirId ? { room_type_id: { not: excluirId } } : {}),
    },
  });
  if (repetido) {
    throw conflicto(
      `Ya existe un tipo de habitación llamado "${repetido.room_type_name}". Elegí otro nombre.`
    );
  }
};

const crear = async (datos = {}) => {
  const { nombre, descripcion, capacidad } = leerCampos(datos);
  await validarNombreLibre(nombre);

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
  const { nombre, descripcion, capacidad } = leerCampos(datos);
  await validarNombreLibre(nombre, actual.room_type_id);

  const estado = toBool(datos.room_type_state ?? datos.estado, null);

  const tipo = await prisma.room_type.update({
    where: { room_type_id: actual.room_type_id },
    data: {
      room_type_name: nombre,
      room_type_description: descripcion,
      room_type_max_capacity: capacidad,
      ...(estado !== null ? { room_type_state: estado } : {}),
    },
    include: CON_CONTEO,
  });
  return presentar(tipo);
};

/**
 * Activo/Inactivo. Un tipo inactivo deja de ofrecerse al registrar habitaciones
 * nuevas, pero las que ya lo tienen asignado no se tocan.
 */
const cambiarEstado = async (id, estado) => {
  const actual = await obtener(id);
  const nuevoEstado = toBool(estado, !actual.room_type_state);

  const tipo = await prisma.room_type.update({
    where: { room_type_id: actual.room_type_id },
    data: { room_type_state: nuevoEstado },
    include: CON_CONTEO,
  });
  return presentar(tipo);
};

/** Baja física, solo permitida si el tipo no tiene habitaciones asociadas. */
const eliminar = async (id) => {
  const actual = await obtener(id);
  const asociadas = actual._count.room;

  if (asociadas > 0) {
    throw conflicto(
      `No se puede eliminar "${actual.room_type_name}": tiene ${asociadas} habitación(es) ` +
        'asociada(s). Reasignalas a otro tipo o desactivá este.'
    );
  }

  await prisma.room_type.delete({ where: { room_type_id: actual.room_type_id } });
  return { room_type_id: actual.room_type_id, room_type_name: actual.room_type_name };
};

module.exports = { listar, obtener, crear, actualizar, cambiarEstado, eliminar };
