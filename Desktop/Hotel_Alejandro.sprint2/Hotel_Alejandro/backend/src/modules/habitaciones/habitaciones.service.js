const prisma = require('../../db/prisma');
const { noEncontrado, conflicto, invalido } = require('../../utils/AppError');
const { toId, toText } = require('../../utils/parse');

/**
 * Habitaciones (HAB-01)
 *
 * Toda habitación nace DISPONIBLE.
 */

const ESTADO_INICIAL = 'DISPONIBLE';

/**
 * Estados permitidos para una habitación.
 */
const ESTADOS = [
  'DISPONIBLE',
  'OCUPADA',
  'MANTENIMIENTO',
];

/**
 * Número de habitación válido.
 * Ejemplos: 101, 202, 2-A
 */
const NUMERO_VALIDO = /^[A-Z0-9][A-Z0-9-]{0,9}$/;

/**
 * Datos del tipo de habitación que necesita la pantalla.
 */
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

/**
 * Normaliza y valida el número de habitación.
 */
const normalizarNumero = (valor) => {
  const numero = toText(valor)?.toUpperCase();

  if (!numero) {
    throw invalido(
      'El número de habitación es obligatorio.'
    );
  }

  if (!NUMERO_VALIDO.test(numero)) {
    throw invalido(
      'El número de habitación solo puede llevar letras, números y guion, hasta 10 caracteres (por ejemplo 101 o 2-A).'
    );
  }

  return numero;
};

/**
 * Orden natural:
 * 2 antes que 10
 * 101 antes que 201
 */
const porNumero = (a, b) =>
  a.room_number.localeCompare(
    b.room_number,
    'es',
    { numeric: true }
  );

/**
 * LISTAR HABITACIONES
 */
const listar = async ({ tipo, estado } = {}) => {
  const where = {};

  // Filtrar por tipo
  const tipoId = toId(tipo);

  if (tipoId) {
    where.room_type_id = tipoId;
  }

  // Filtrar por estado
  const estadoFiltro = toText(estado)?.toUpperCase();

  if (estadoFiltro) {
    if (!ESTADOS.includes(estadoFiltro)) {
      throw invalido(
        `El estado tiene que ser uno de: ${ESTADOS.join(', ')}.`
      );
    }

    where.room_state = estadoFiltro;
  }

  const habitaciones = await prisma.room.findMany({
    where,
    include: CON_TIPO,
  });

  return habitaciones.sort(porNumero);
};

/**
 * OBTENER UNA HABITACIÓN
 */
const obtener = async (id) => {
  const roomId = toId(id);

  if (!roomId) {
    throw invalido(
      'El identificador de la habitación no es válido.'
    );
  }

  const habitacion = await prisma.room.findUnique({
    where: {
      room_id: roomId,
    },
    include: CON_TIPO,
  });

  if (!habitacion) {
    throw noEncontrado(
      'La habitación no existe.'
    );
  }

  return habitacion;
};

/**
 * CREAR UNA HABITACIÓN
 *
 * Toda habitación nueva comienza DISPONIBLE.
 */
const crear = async (datos = {}) => {
  const numero = normalizarNumero(
    datos.room_number ?? datos.numero
  );

  const tipoId = toId(
    datos.room_type_id ?? datos.tipo
  );

  if (!tipoId) {
    throw invalido(
      'Elegí el tipo de habitación.'
    );
  }

  // Verificar que exista el tipo
  const tipo = await prisma.room_type.findUnique({
    where: {
      room_type_id: tipoId,
    },
  });

  if (!tipo) {
    throw invalido(
      'El tipo de habitación elegido no existe.'
    );
  }

  // Verificar que el tipo esté activo
  if (!tipo.room_type_state) {
    throw conflicto(
      `El tipo "${tipo.room_type_name}" está inactivo. Activalo desde el catálogo o elegí otro.`
    );
  }

  // Verificar que no exista otra habitación con ese número
  const repetida = await prisma.room.findUnique({
    where: {
      room_number: numero,
    },
    select: {
      room_id: true,
    },
  });

  if (repetida) {
    throw conflicto(
      `Ya existe la habitación ${numero}. Usá otro número.`
    );
  }

  // Crear habitación
  return prisma.room.create({
    data: {
      room_number: numero,
      room_type_id: tipo.room_type_id,
      room_state: ESTADO_INICIAL,
    },
    include: CON_TIPO,
  });
};

/**
 * CAMBIAR ESTADO DE UNA HABITACIÓN
 *
 * Estados permitidos:
 * DISPONIBLE
 * OCUPADA
 * MANTENIMIENTO
 */
const cambiarEstado = async (id, estado) => {
  const roomId = toId(id);

  if (!roomId) {
    throw invalido(
      'El identificador de la habitación no es válido.'
    );
  }

  const nuevoEstado = toText(estado)?.toUpperCase();

  if (
    !nuevoEstado ||
    !ESTADOS.includes(nuevoEstado)
  ) {
    throw invalido(
      `El estado tiene que ser uno de: ${ESTADOS.join(', ')}.`
    );
  }

  // Verificar que la habitación exista
  const habitacion = await prisma.room.findUnique({
    where: {
      room_id: roomId,
    },
  });

  if (!habitacion) {
    throw noEncontrado(
      'La habitación no existe.'
    );
  }

  // Actualizar estado
  return prisma.room.update({
    where: {
      room_id: roomId,
    },
    data: {
      room_state: nuevoEstado,
    },
    include: CON_TIPO,
  });
};

/**
 * EXPORTACIONES
 *
 * IMPORTANTE:
 * listar y cambiarEstado tienen que estar acá.
 */
module.exports = {
  ESTADOS,
  ESTADO_INICIAL,
  listar,
  obtener,
  crear,
  cambiarEstado,
};