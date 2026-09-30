const prisma = require('../../db/prisma');
const env = require('../../config/env');
const { noEncontrado, invalido } = require('../../utils/AppError');
const { toId, toText, toBool } = require('../../utils/parse');
const {
  TIPOS,
  soloFecha,
  validarApertura,
  validarCierre,
  validarMarcarLimpia,
} = require('./housekeeping.reglas');

/**
 * HU-9 (HAB-06) — Mantenimiento y limpieza de habitaciones.
 *
 * INDEPENDENCIA DE LAS DEMÁS HISTORIAS
 * Este módulo lee `room` directamente con Prisma y no importa nada de los
 * módulos de habitaciones (HAB-01), tipos (HAB-03) ni reservas (RES-*). Así
 * funciona hoy con las habitaciones de la semilla, y cuando el resto del
 * equipo suba sus módulos no hay que tocar nada.
 *
 * QUIÉN MUEVE EL ESTADO
 * El estado de la habitación lo cambian los triggers de la base
 * (tr_sync_room_maintenance), no este service. Acá solo se insertan y cierran
 * bloqueos. Si el cambio de estado dependiera del backend, un error entre dos
 * escrituras dejaría el bloqueo registrado y la habitación en el estado
 * anterior.
 */

const includeBloqueo = {
  room: {
    select: {
      room_id: true,
      room_number: true,
      floor_number: true,
      room_state: true,
      room_type: { select: { room_type_name: true } },
    },
  },
  employee_opened: { select: { employees_name: true, employees_lastname: true } },
  employee_closed: { select: { employees_name: true, employees_lastname: true } },
};

/**
 * El frontend trabaja con `room_status`; en Prisma ese campo se llama
 * `room_state` (mapeado a la columna room_status). La traducción se hace acá,
 * en el borde del módulo, para que la API no exponga el nombre interno.
 */
const aDTO = (bloqueo) =>
  bloqueo && bloqueo.room
    ? { ...bloqueo, room: { ...bloqueo.room, room_status: bloqueo.room.room_state } }
    : bloqueo;

/** Fecha YYYY-MM-DD, o null si no es válida. */
const toDate = (valor) => {
  const texto = toText(valor);
  if (!texto) return null;
  const fecha = new Date(`${texto}T00:00:00`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

const empleadoActual = (payload) => toId(payload?.employees_id) || env.DEFAULT_EMPLOYEE_ID;

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/**
 * Tablero de housekeeping: todas las habitaciones activas con su estado y el
 * bloqueo vigente, si lo hay. Es la pantalla que Gobernanza mira al empezar el
 * turno para saber qué hay que limpiar.
 */
const getTablero = async ({ estado } = {}) => {
  const estadoFiltro = toText(estado)?.toUpperCase();

  const habitaciones = await prisma.room.findMany({
    where: {
      active: true,
      ...(estadoFiltro ? { room_state: estadoFiltro } : {}),
    },
    select: {
      room_id: true,
      room_number: true,
      floor_number: true,
      room_state: true,
      room_type: { select: { room_type_name: true, room_type_max_capacity: true } },
      maintenances: {
        where: { actual_end_date: null },
        orderBy: { start_date: 'asc' },
        select: {
          maintenance_id: true,
          maintenance_type: true,
          start_date: true,
          estimated_end_date: true,
          reason: true,
        },
      },
    },
    orderBy: [{ floor_number: 'asc' }, { room_number: 'asc' }],
  });

  const hoy = soloFecha(new Date());

  return habitaciones.map((h) => {
    const vigente = h.maintenances.find((m) => soloFecha(new Date(m.start_date)) <= hoy) ?? null;
    const programados = h.maintenances.filter((m) => soloFecha(new Date(m.start_date)) > hoy);

    return {
      room_id: h.room_id,
      room_number: h.room_number,
      floor_number: h.floor_number,
      room_status: h.room_state,
      room_type_name: h.room_type.room_type_name,
      max_capacity: h.room_type.room_type_max_capacity,
      bloqueo_vigente: vigente,
      bloqueos_programados: programados,
      /**
       * Una habitación en LIMPIEZA sin bloqueo abierto es la que salió del
       * check-out. Se marca aparte porque es la tarea más urgente del turno.
       */
      pendiente_post_checkout: h.room_state === 'LIMPIEZA' && !vigente,
    };
  });
};

/** Resumen por estado, para las tarjetas del encabezado y para HAB-04. */
const getResumen = async () => {
  const grupos = await prisma.room.groupBy({
    by: ['room_state'],
    where: { active: true },
    _count: { room_id: true },
  });

  const resumen = { DISPONIBLE: 0, OCUPADA: 0, LIMPIEZA: 0, MANTENIMIENTO: 0, FUERA_DE_SERVICIO: 0 };
  for (const g of grupos) resumen[g.room_state] = g._count.room_id;

  return { ...resumen, TOTAL: Object.values(resumen).reduce((a, b) => a + b, 0) };
};

const listar = async ({ habitacion, abiertos, tipo } = {}) => {
  const roomId = toId(habitacion);
  const soloAbiertos = toBool(abiertos, false);
  const tipoFiltro = toText(tipo)?.toUpperCase();

  if (tipoFiltro && !TIPOS.includes(tipoFiltro)) {
    throw invalido(`El tipo tiene que ser uno de: ${TIPOS.join(', ')}.`);
  }

  const bloqueos = await prisma.room_maintenance.findMany({
    where: {
      ...(roomId ? { room_id: roomId } : {}),
      ...(soloAbiertos ? { actual_end_date: null } : {}),
      ...(tipoFiltro ? { maintenance_type: tipoFiltro } : {}),
    },
    include: includeBloqueo,
    orderBy: [{ actual_end_date: { sort: 'asc', nulls: 'first' } }, { start_date: 'desc' }],
  });

  return bloqueos.map(aDTO);
};

const obtener = async (id) => {
  const maintenanceId = toId(id);
  if (!maintenanceId) throw invalido('El identificador del bloqueo no es válido.');

  const bloqueo = await prisma.room_maintenance.findUnique({
    where: { maintenance_id: maintenanceId },
    include: includeBloqueo,
  });

  if (!bloqueo) throw noEncontrado('El bloqueo no existe.');
  return aDTO(bloqueo);
};

/** Historial completo de una habitación: todos sus bloqueos, abiertos y cerrados. */
const historial = async (roomIdParam) => {
  const roomId = toId(roomIdParam);
  if (!roomId) throw invalido('El identificador de la habitación no es válido.');

  const habitacion = await prisma.room.findUnique({
    where: { room_id: roomId },
    select: { room_id: true, room_number: true, room_state: true },
  });
  if (!habitacion) throw noEncontrado('La habitación no existe.');

  const bloqueos = await prisma.room_maintenance.findMany({
    where: { room_id: roomId },
    include: includeBloqueo,
    orderBy: { start_date: 'desc' },
  });

  return {
    habitacion: { ...habitacion, room_status: habitacion.room_state },
    bloqueos: bloqueos.map(aDTO),
  };
};

// ---------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------

/**
 * Abre un bloqueo de limpieza, mantenimiento o fuera de servicio.
 *
 * Payload:
 * {
 *   room_id:            number,
 *   maintenance_type:   'LIMPIEZA' | 'MANTENIMIENTO' | 'FUERA_DE_SERVICIO',
 *   start_date:         'YYYY-MM-DD',   // hoy o futuro
 *   estimated_end_date: 'YYYY-MM-DD',
 *   reason:             string
 * }
 *
 * Si el inicio es hoy, la habitación cambia de estado en el momento. Si es a
 * futuro, queda programado y afecta solo la disponibilidad de esas fechas.
 */
const abrir = async (payload = {}) => {
  const roomId = toId(payload.room_id ?? payload.habitacionId);
  if (!roomId) throw invalido('Elegí la habitación.');

  const tipo = toText(payload.maintenance_type ?? payload.tipo)?.toUpperCase() ?? 'MANTENIMIENTO';
  const inicio = toDate(payload.start_date ?? payload.fechaInicio);
  const finEstimado = toDate(payload.estimated_end_date ?? payload.fechaFinEstimada);
  const motivo = toText(payload.reason ?? payload.motivo);

  const fila = await prisma.room.findUnique({ where: { room_id: roomId } });
  const habitacion = fila ? { ...fila, room_status: fila.room_state } : null;

  validarApertura({ habitacion, tipo, inicio, finEstimado, motivo, hoy: new Date() });

  /**
   * La base valida además:
   *   - que no haya otro bloqueo abierto superpuesto (EXCLUDE)
   *   - que un MANTENIMIENTO no pise reservas activas (trigger)
   * Esos errores llegan con su mensaje por el errorHandler central.
   */
  const creado = await prisma.room_maintenance.create({
    data: {
      room_id: roomId,
      maintenance_type: tipo,
      start_date: inicio,
      estimated_end_date: finEstimado,
      reason: motivo,
      opened_by: empleadoActual(payload),
    },
  });

  return obtener(creado.maintenance_id);
};

/**
 * Finaliza un bloqueo. El trigger devuelve la habitación a DISPONIBLE, salvo
 * que tenga otro bloqueo vigente abierto.
 */
const finalizar = async (id, payload = {}) => {
  const maintenanceId = toId(id);
  if (!maintenanceId) throw invalido('El identificador del bloqueo no es válido.');

  const bloqueo = await prisma.room_maintenance.findUnique({ where: { maintenance_id: maintenanceId } });
  const fechaFin = toDate(payload.actual_end_date ?? payload.fechaFin) ?? soloFecha(new Date());

  const { seAtraso } = validarCierre({ bloqueo, fechaFin, hoy: new Date() });

  await prisma.room_maintenance.update({
    where: { maintenance_id: maintenanceId },
    data: {
      actual_end_date: fechaFin,
      closing_notes: toText(payload.closing_notes ?? payload.observaciones),
      closed_by: empleadoActual(payload),
    },
  });

  return { ...(await obtener(maintenanceId)), se_atraso: seAtraso };
};

/**
 * Acción rápida de housekeeping: "Marcar limpia".
 *
 * Resuelve los dos orígenes posibles de una habitación en LIMPIEZA:
 *   - un bloqueo de limpieza abierto a mano -> se cierra
 *   - el check-out (RES-11), que la deja en LIMPIEZA sin bloqueo -> se crea
 *     el registro y se cierra en la misma transacción
 *
 * El segundo caso es el importante: sin él, las habitaciones que salen del
 * check-out quedarían trabadas en LIMPIEZA, porque no habría ningún bloqueo que
 * cerrar. Crear y cerrar el registro, en lugar de cambiar el estado a mano,
 * deja además constancia de quién la limpió y cuándo.
 */
const marcarLimpia = async (roomIdParam, payload = {}) => {
  const roomId = toId(roomIdParam);
  if (!roomId) throw invalido('El identificador de la habitación no es válido.');

  const fila = await prisma.room.findUnique({ where: { room_id: roomId } });
  const habitacion = fila ? { ...fila, room_status: fila.room_state } : null;
  validarMarcarLimpia(habitacion);

  const empleado = empleadoActual(payload);
  const hoy = soloFecha(new Date());
  const notas = toText(payload.closing_notes ?? payload.observaciones) ?? 'Limpieza finalizada';

  return prisma.$transaction(async (tx) => {
    let bloqueo = await tx.room_maintenance.findFirst({
      where: { room_id: roomId, maintenance_type: 'LIMPIEZA', actual_end_date: null },
      orderBy: { start_date: 'asc' },
    });

    // Caso post check-out: no hay bloqueo, se registra la limpieza.
    if (!bloqueo) {
      bloqueo = await tx.room_maintenance.create({
        data: {
          room_id: roomId,
          maintenance_type: 'LIMPIEZA',
          start_date: hoy,
          estimated_end_date: hoy,
          reason: 'Limpieza posterior al check-out',
          opened_by: empleado,
        },
      });
    }

    // Al cerrarlo, el trigger devuelve la habitación a DISPONIBLE.
    await tx.room_maintenance.update({
      where: { maintenance_id: bloqueo.maintenance_id },
      data: { actual_end_date: hoy, closing_notes: notas, closed_by: empleado },
    });

    const actualizada = await tx.room.findUnique({
      where: { room_id: roomId },
      select: { room_id: true, room_number: true, room_state: true },
    });

    return { ...actualizada, room_status: actualizada.room_state };
  });
};

module.exports = {
  getTablero,
  getResumen,
  listar,
  obtener,
  historial,
  abrir,
  finalizar,
  marcarLimpia,
};
