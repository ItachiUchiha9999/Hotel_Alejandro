const prisma = require('../../db/prisma');
const { noEncontrado, conflicto, invalido } = require('../../utils/AppError');
const { toId, toText, toPositive } = require('../../utils/parse');

/**
 * Habitaciones (HAB-01 y RES-05)
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
      room_type_description: true,
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
    throw invalido('El número de habitación es obligatorio.');
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
  a.room_number.localeCompare(b.room_number, 'es', { numeric: true });

/**
 * LISTAR HABITACIONES
 */
const listar = async ({ tipo, estado } = {}) => {
  const where = {};

  const tipoId = toId(tipo);
  if (tipoId) {
    where.room_type_id = tipoId;
  }

  const estadoFiltro = toText(estado)?.toUpperCase();
  if (estadoFiltro) {
    if (!ESTADOS.includes(estadoFiltro)) {
      throw invalido(`El estado tiene que ser uno de: ${ESTADOS.join(', ')}.`);
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
    throw invalido('El identificador de la habitación no es válido.');
  }

  const habitacion = await prisma.room.findUnique({
    where: { room_id: roomId },
    include: CON_TIPO,
  });

  if (!habitacion) {
    throw noEncontrado('La habitación no existe.');
  }

  return habitacion;
};

/**
 * CONSULTAR DISPONIBILIDAD (RES-05)
 *
 * Criterios de aceptación:
 * - Filtros obligatorios: Fecha Desde (Check-in) y Fecha Hasta (Check-out).
 * - Solo habitaciones en estado 'DISPONIBLE'.
 * - Filtro opcional por capacidad (room_type_max_capacity >= capacidad).
 * - Multiplica el precio por noche por la cantidad de noches.
 */
const consultarDisponibilidad = async ({ desde, hasta, capacidad, tipo } = {}) => {
  // 1. Validaciones obligatorias de fechas
  if (!desde || !hasta) {
    throw invalido('Las fechas de Check-in (desde) y Check-out (hasta) son obligatorias.');
  }

  const fechaDesde = new Date(`${toText(desde)}T00:00:00`);
  const fechaHasta = new Date(`${toText(hasta)}T00:00:00`);

  if (Number.isNaN(fechaDesde.getTime()) || Number.isNaN(fechaHasta.getTime())) {
    throw invalido('El formato de las fechas no es válido. Usá AAAA-MM-DD.');
  }

  if (fechaHasta <= fechaDesde) {
    throw invalido('La fecha de Check-out debe ser posterior a la fecha de Check-in.');
  }

  const msPorDia = 1000 * 60 * 60 * 24;
  const noches = Math.round((fechaHasta - fechaDesde) / msPorDia);

  if (noches <= 0) {
    throw invalido('La estadía mínima es de 1 noche.');
  }

  // 2. Filtros de capacidad y tipo
  const cap = capacidad ? toPositive(capacidad) : null;
  const tipoId = tipo ? toId(tipo) : null;

  // La función de PostgreSQL es la fuente única de disponibilidad: usa la
  // tarifa vigente y también descarta reservas, holds y mantenimientos.
  const disponibles = await prisma.$queryRaw`
    SELECT * FROM fn_available_rooms(
      ${toText(desde)}::date,
      ${toText(hasta)}::date,
      ${cap || 1}::smallint
    )
  `;

  const resultado = disponibles
    .filter((habitacion) => !tipoId || habitacion.room_type_id === tipoId)
    .map((habitacion) => ({
    room_id: habitacion.room_id,
    room_number: habitacion.room_number,
    room_state: 'DISPONIBLE',
    room_type: {
      room_type_id: habitacion.room_type_id,
      room_type_name: habitacion.room_type_name,
      room_type_description: null,
      room_type_max_capacity: habitacion.max_capacity,
    },
    noches: Number(habitacion.nights),
    precio_por_noche: habitacion.price_per_night,
    precio_total_estimado: habitacion.total_estimated,
    }));

  return {
    filtros: {
      desde: toText(desde),
      hasta: toText(hasta),
      noches,
      capacidad_solicitada: cap,
    },
    total_disponibles: resultado.length,
    habitaciones: resultado,
  };
};

/**
 * CREAR UNA HABITACIÓN
 */
const crear = async (datos = {}) => {
  const numero = normalizarNumero(datos.room_number ?? datos.numero);
  const tipoId = toId(datos.room_type_id ?? datos.tipo);

  if (!tipoId) {
    throw invalido('Elegí el tipo de habitación.');
  }

  const tipo = await prisma.room_type.findUnique({
    where: { room_type_id: tipoId },
  });

  if (!tipo) {
    throw invalido('El tipo de habitación elegido no existe.');
  }

  if (!tipo.room_type_state) {
    throw conflicto(
      `El tipo "${tipo.room_type_name}" está inactivo. Activalo desde el catálogo o elegí otro.`
    );
  }

  const repetida = await prisma.room.findUnique({
    where: { room_number: numero },
    select: { room_id: true },
  });

  if (repetida) {
    throw conflicto(`Ya existe la habitación ${numero}. Usá otro número.`);
  }

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
 */
const cambiarEstado = async (id, estado) => {
  const roomId = toId(id);

  if (!roomId) {
    throw invalido('El identificador de la habitación no es válido.');
  }

  const nuevoEstado = toText(estado)?.toUpperCase();

  if (!nuevoEstado || !ESTADOS.includes(nuevoEstado)) {
    throw invalido(`El estado tiene que ser uno de: ${ESTADOS.join(', ')}.`);
  }

  const habitacion = await prisma.room.findUnique({
    where: { room_id: roomId },
  });

  if (!habitacion) {
    throw noEncontrado('La habitación no existe.');
  }

  return prisma.room.update({
    where: { room_id: roomId },
    data: { room_state: nuevoEstado },
    include: CON_TIPO,
  });
};

module.exports = {
  ESTADOS,
  ESTADO_INICIAL,
  listar,
  obtener,
  consultarDisponibilidad,
  crear,
  cambiarEstado,
};