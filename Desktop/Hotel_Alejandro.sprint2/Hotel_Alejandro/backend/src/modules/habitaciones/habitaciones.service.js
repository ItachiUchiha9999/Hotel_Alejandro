const prisma = require('../../db/prisma');
const { noEncontrado, conflicto, invalido } = require('../../utils/AppError');
const { toId, toText } = require('../../utils/parse');

/**
 * Habitaciones (HAB-01).
 *
 * Reglas del backlog:
 *  - El número de habitación es único.
 *  - Se asigna obligatoriamente un tipo existente y ACTIVO.
 *  - El estado inicial por defecto es 'DISPONIBLE'.
 *
 * El estado NO se edita desde acá: lo mueven HAB-06 (mantenimiento/limpieza),
 * RES-09 (check-in, pasa a OCUPADA) y RES-11 (check-out).
 */

const NUMERO_MAX = 10;

/** Estados en los que se puede dar de alta una habitación. OCUPADA solo sale de un check-in. */
const ESTADOS_INICIALES = ['DISPONIBLE', 'MANTENIMIENTO'];

const CON_TIPO = {
  room_type: {
    select: {
      room_type_id: true,
      room_type_name: true,
      room_type_max_capacity: true,
      room_type_state: true,
    },
  },
};

const listar = async () =>
  prisma.room.findMany({ include: CON_TIPO, orderBy: { room_number: 'asc' } });

const obtener = async (id) => {
  const roomId = toId(id);
  if (!roomId) throw invalido('El identificador de la habitación no es válido.');

  const habitacion = await prisma.room.findUnique({
    where: { room_id: roomId },
    include: CON_TIPO,
  });
  if (!habitacion) throw noEncontrado('La habitación no existe.');
  return habitacion;
};

const leerNumero = (datos) => {
  const numero = toText(datos.room_number ?? datos.numero);
  if (!numero) throw invalido('El número de habitación es obligatorio.');
  if (numero.length > NUMERO_MAX) {
    throw invalido(`El número de habitación admite hasta ${NUMERO_MAX} caracteres.`);
  }
  return numero;
};

const leerTipoId = (datos) => {
  const tipoId = toId(datos.room_type_id ?? datos.tipo_id);
  if (!tipoId) throw invalido('Seleccioná un tipo de habitación.');
  return tipoId;
};

/** "101" y "101" iguales; también "a1" y "A1" (sin distinguir mayúsculas). */
const validarNumeroLibre = async (numero, excluirId) => {
  const repetida = await prisma.room.findFirst({
    where: {
      room_number: { equals: numero, mode: 'insensitive' },
      ...(excluirId ? { room_id: { not: excluirId } } : {}),
    },
  });
  if (repetida) {
    throw conflicto(`Ya existe la habitación número "${repetida.room_number}". Usá otro número.`);
  }
};

const validarTipoActivo = async (tipoId) => {
  const tipo = await prisma.room_type.findUnique({ where: { room_type_id: tipoId } });
  if (!tipo) throw invalido('El tipo de habitación seleccionado no existe.');
  if (!tipo.room_type_state) {
    throw invalido(
      `El tipo "${tipo.room_type_name}" está inactivo. Elegí un tipo activo o reactivalo.`
    );
  }
};

const crear = async (datos = {}) => {
  const numero = leerNumero(datos);
  const tipoId = leerTipoId(datos);

  const estado = (toText(datos.room_state ?? datos.estado) ?? 'DISPONIBLE').toUpperCase();
  if (!ESTADOS_INICIALES.includes(estado)) {
    throw invalido('Una habitación nueva solo puede quedar Disponible o en Mantenimiento/Limpieza.');
  }

  await validarNumeroLibre(numero);
  await validarTipoActivo(tipoId);

  return prisma.room.create({
    data: { room_number: numero, room_type_id: tipoId, room_state: estado },
    include: CON_TIPO,
  });
};

/** Edita número y tipo. El estado se ignora a propósito (ver cabecera). */
const actualizar = async (id, datos = {}) => {
  const actual = await obtener(id);
  const numero = leerNumero(datos);
  const tipoId = leerTipoId(datos);

  await validarNumeroLibre(numero, actual.room_id);
  // Solo se exige tipo activo si realmente cambia: una habitación puede seguir
  // con su tipo aunque ese tipo se haya desactivado después.
  if (tipoId !== actual.room_type_id) await validarTipoActivo(tipoId);

  return prisma.room.update({
    where: { room_id: actual.room_id },
    data: { room_number: numero, room_type_id: tipoId },
    include: CON_TIPO,
  });
};

module.exports = { ESTADOS_INICIALES, listar, obtener, crear, actualizar };
