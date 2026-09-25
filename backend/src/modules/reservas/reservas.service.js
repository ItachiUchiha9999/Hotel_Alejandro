const prisma = require('../../db/prisma');
const { Prisma } = require('@prisma/client');
const { conflicto, invalido, noEncontrado } = require('../../utils/AppError');

const ESTADOS_EDITABLES = ['PENDIENTE', 'CONFIRMADA'];
const asId = (value, label) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw invalido(`${label} no es válido.`);
  return id;
};
const asDate = (value, label) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalido(`${label} debe tener formato AAAA-MM-DD.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw invalido(`${label} no es válida.`);
  return date;
};
const validarRango = (ingreso, egreso) => {
  if (egreso <= ingreso) throw invalido('La fecha de egreso debe ser posterior a la fecha de ingreso.');
};
const validarEmpleado = async (tx, employeeId) => {
  const employee = await tx.employees.findUnique({ where: { employees_id: employeeId }, select: { employees_state: true } });
  if (!employee || !employee.employees_state) throw invalido('El usuario de recepción no existe o está inactivo.');
};
const liberarVencidas = (tx) => tx.$executeRaw`UPDATE "room_hold" SET released = TRUE WHERE released = FALSE AND expires_at <= CURRENT_TIMESTAMP`;
const validarSolapamiento = async (tx, roomId, ingreso, egreso, excluirId = null) => {
  const rows = await tx.$queryRaw`
    SELECT reservation_id FROM "reservation"
    WHERE room_id = ${roomId} AND reservation_status IN ('PENDIENTE', 'CONFIRMADA', 'IN_HOUSE')
      AND check_in_date < ${egreso} AND check_out_date > ${ingreso}
      ${excluirId ? Prisma.sql`AND reservation_id <> ${excluirId}` : Prisma.empty}
    LIMIT 1`;
  if (rows.length) throw conflicto('La habitación ya está ocupada para esas fechas.');
};
const obtenerHabitacionYTarifa = async (tx, roomId, ingreso) => {
  const locked = await tx.$queryRaw`SELECT room_id FROM "room" WHERE room_id = ${roomId} FOR UPDATE`;
  if (!locked.length) throw noEncontrado('La habitación no existe.');

  const room = await tx.room.findUnique({
    where: { room_id: roomId },
    include: {
      room_type: {
        include: {
          rates: {
            where: {
              valid_from: { lte: ingreso },
              OR: [{ valid_to: null }, { valid_to: { gt: ingreso } }],
            },
            orderBy: { valid_from: 'desc' },
            take: 1,
          },
        },
      },
    },
  });
  if (!room) throw noEncontrado('La habitación no existe.');
  if (!room.active || ['FUERA_DE_SERVICIO', 'MANTENIMIENTO'].includes(room.room_state)) throw conflicto('La habitación no está habilitada para reservas.');
  const rate = room.room_type.rates[0];
  if (!rate || Number(rate.base_price) <= 0) throw conflicto('La habitación no tiene una tarifa vigente para la fecha elegida.');
  return { ...room, rate_id: rate.rate_id, base_price: rate.base_price };
};
const incluir = {
  guest: { select: { guest_id: true, document_type: true, document_number: true, first_name: true, last_name: true } },
  room: { select: { room_id: true, room_number: true } },
};

const crear = async ({ guestId, roomId, checkIn, checkOut, status = 'CONFIRMADA', employeeId, adults = 1, children = 0 }) => {
  const guest = asId(guestId, 'El perfil de huésped');
  const roomIdNumber = asId(roomId, 'La habitación');
  const empleado = asId(employeeId, 'El usuario');
  const ingreso = asDate(checkIn, 'La fecha de ingreso');
  const egreso = asDate(checkOut, 'La fecha de egreso');
  validarRango(ingreso, egreso);
  if (!ESTADOS_EDITABLES.includes(status)) throw invalido('El estado inicial debe ser PENDIENTE o CONFIRMADA.');
  return prisma.$transaction(async (tx) => {
    await validarEmpleado(tx, empleado);
    await liberarVencidas(tx);
    const perfil = await tx.guest.findUnique({ where: { guest_id: guest } });
    if (!perfil || !perfil.guest_state) throw noEncontrado('El perfil de huésped no existe o está inactivo.');
    const room = await obtenerHabitacionYTarifa(tx, roomIdNumber, ingreso);
    await validarSolapamiento(tx, roomIdNumber, ingreso, egreso);
    return tx.reservation.create({ data: {
      reservation_code: '',
      guest_id: guest, room_id: roomIdNumber, check_in_date: ingreso, check_out_date: egreso,
      adults: Number(adults), children: Number(children), price_per_night: room.base_price,
      rate_id: room.rate_id, reservation_status: status, reservation_source: 'RECEPCION', employees_id: empleado,
    }, include: incluir });
  }, { isolationLevel: 'Serializable' });
};

const modificar = async (id, datos, employeeId) => {
  const reservationId = asId(id, 'La reserva');
  const empleado = asId(employeeId, 'El usuario');
  return prisma.$transaction(async (tx) => {
    await validarEmpleado(tx, empleado);
    const actual = await tx.reservation.findUnique({ where: { reservation_id: reservationId } });
    if (!actual) throw noEncontrado('La reserva no existe.');
    if (!ESTADOS_EDITABLES.includes(actual.reservation_status)) throw conflicto('No se puede modificar una reserva que ya tuvo check-in o fue finalizada.');
    const roomId = datos.roomId === undefined ? actual.room_id : asId(datos.roomId, 'La habitación');
    const ingreso = datos.checkIn === undefined ? actual.check_in_date : asDate(datos.checkIn, 'La fecha de ingreso');
    const egreso = datos.checkOut === undefined ? actual.check_out_date : asDate(datos.checkOut, 'La fecha de egreso');
    validarRango(ingreso, egreso);
    const room = await obtenerHabitacionYTarifa(tx, roomId, ingreso);
    await validarSolapamiento(tx, roomId, ingreso, egreso, reservationId);
    return tx.reservation.update({ where: { reservation_id: reservationId }, data: {
      room_id: roomId, check_in_date: ingreso, check_out_date: egreso,
      price_per_night: room.base_price, rate_id: room.rate_id, employees_id: empleado,
    }, include: incluir });
  }, { isolationLevel: 'Serializable' });
};

const cancelar = async (id, reason, employeeId) => {
  const reservationId = asId(id, 'La reserva');
  const empleado = asId(employeeId, 'El usuario');
  const motivo = String(reason || '').trim();
  if (!motivo) throw invalido('El motivo de cancelación es obligatorio.');
  return prisma.$transaction(async (tx) => {
    await validarEmpleado(tx, empleado);
    const actual = await tx.reservation.findUnique({ where: { reservation_id: reservationId } });
    if (!actual) throw noEncontrado('La reserva no existe.');
    if (!ESTADOS_EDITABLES.includes(actual.reservation_status)) throw conflicto('No se puede cancelar una reserva que ya tuvo check-in o fue finalizada.');
    return tx.reservation.update({ where: { reservation_id: reservationId }, data: {
      reservation_status: 'CANCELADA', cancellation_reason: motivo, cancelled_at: new Date(), employees_id: empleado,
    }, include: incluir });
  }, { isolationLevel: 'Serializable' });
};

const crearHold = async ({ roomId, checkIn, checkOut, employeeId }) => {
  const room = asId(roomId, 'La habitación');
  const empleado = asId(employeeId, 'El usuario');
  const ingreso = asDate(checkIn, 'La fecha de ingreso');
  const egreso = asDate(checkOut, 'La fecha de egreso');
  validarRango(ingreso, egreso);
  return prisma.$transaction(async (tx) => {
    await validarEmpleado(tx, empleado);
    await liberarVencidas(tx);
    await obtenerHabitacionYTarifa(tx, room, ingreso);
    await validarSolapamiento(tx, room, ingreso, egreso);
    try {
      return await tx.room_hold.create({ data: { room_id: room, check_in_date: ingreso, check_out_date: egreso, employees_id: empleado } });
    } catch (error) {
      if (error.code === 'P2002' || error.code === 'P2034') throw conflicto('La habitación fue retenida por otra carga simultánea.');
      throw error;
    }
  }, { isolationLevel: 'Serializable' });
};
const liberarHold = async (id, employeeId) => {
  const holdId = asId(id, 'La retención');
  await validarEmpleado(prisma, asId(employeeId, 'El usuario'));
  return prisma.room_hold.update({ where: { hold_id: holdId }, data: { released: true } });
};
const listarHuespedes = () => prisma.guest.findMany({ where: { guest_state: true }, orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }] });
const listarHabitaciones = () => prisma.room.findMany({
  where: { active: true, room_state: { notIn: ['FUERA_DE_SERVICIO', 'MANTENIMIENTO'] } },
  select: { room_id: true, room_number: true, room_state: true, room_type: { select: { room_type_name: true } } }, orderBy: { room_number: 'asc' },
});
const catalogos = async () => Promise.all([listarHuespedes(), listarHabitaciones()]).then(([huespedes, habitaciones]) => ({ huespedes, habitaciones }));

// -----------------------------------------------------------------------
// RES-09 (check-in) y RES-11 (check-out).
//
// Hacer el check-in/check-out ES insertar una fila en reservation_check_in /
// reservation_check_out: los triggers tr_process_check_in / tr_process_check_out
// de la base validan el estado (y, en el check-in, que la fecha ya llegó) y
// mueven reservation_status + room_state (room_status) solos. Esta capa NO
// hace ningún update manual de esos dos campos.
//
// Igual que crear/modificar/cancelar arriba, se valida antes en JS para dar
// un mensaje amigable (409/400) en el caso común, y se deja el trigger como
// última palabra por si dos personas hacen el check-in/out casi al mismo
// tiempo — ahí el P2002 (o el error del trigger, si llega a pasar) se
// traduce igual.
// -----------------------------------------------------------------------

const ESTADOS_RESERVA = ['PENDIENTE', 'CONFIRMADA', 'IN_HOUSE', 'FINALIZADA', 'CANCELADA', 'NO_SHOW'];

const incluirDetalle = {
  ...incluir,
  check_in: true,
  check_out: true,
};

const checkIn = async (id, { employeeId, actualAdults, actualChildren, observations } = {}) => {
  const reservationId = asId(id, 'La reserva');
  const empleado = asId(employeeId, 'El usuario');

  return prisma.$transaction(async (tx) => {
    await validarEmpleado(tx, empleado);

    const reserva = await tx.reservation.findUnique({ where: { reservation_id: reservationId } });
    if (!reserva) throw noEncontrado('La reserva no existe.');
    if (!ESTADOS_EDITABLES.includes(reserva.reservation_status)) {
      throw conflicto(`Solo se puede hacer check-in de una reserva confirmada o pendiente. Estado actual: ${reserva.reservation_status}.`);
    }
    const hoy = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    if (hoy < reserva.check_in_date) {
      throw conflicto(`El check-in no puede registrarse antes del ${reserva.check_in_date.toISOString().slice(0, 10)}.`);
    }

    try {
      await tx.reservation_check_in.create({
        data: {
          reservation_id: reservationId,
          employees_id: empleado,
          actual_adults: actualAdults ?? null,
          actual_children: actualChildren ?? null,
          observations: observations || null,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') throw conflicto('Esta reserva ya tiene un check-in registrado.');
      throw error;
    }

    return tx.reservation.findUnique({ where: { reservation_id: reservationId }, include: incluir });
  }, { isolationLevel: 'Serializable' });
};

const checkOut = async (id, { employeeId, pendingCharges, pendingDetail, observations } = {}) => {
  const reservationId = asId(id, 'La reserva');
  const empleado = asId(employeeId, 'El usuario');

  return prisma.$transaction(async (tx) => {
    await validarEmpleado(tx, empleado);

    const reserva = await tx.reservation.findUnique({ where: { reservation_id: reservationId } });
    if (!reserva) throw noEncontrado('La reserva no existe.');
    if (reserva.reservation_status !== 'IN_HOUSE') {
      throw conflicto(`Solo se puede hacer check-out de una reserva con check-in realizado. Estado actual: ${reserva.reservation_status}.`);
    }

    try {
      await tx.reservation_check_out.create({
        data: {
          reservation_id: reservationId,
          employees_id: empleado,
          pending_charges: Boolean(pendingCharges),
          pending_detail: pendingCharges ? (pendingDetail || null) : null,
          observations: observations || null,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') throw conflicto('Esta reserva ya tiene un check-out registrado.');
      throw error;
    }

    return tx.reservation.findUnique({ where: { reservation_id: reservationId }, include: incluir });
  }, { isolationLevel: 'Serializable' });
};

// Listado y detalle (pantalla de recepción). Filtros opcionales.
const listar = async ({ estado, roomId, desde, hasta } = {}) => {
  const where = {};
  if (estado) {
    if (!ESTADOS_RESERVA.includes(estado)) throw invalido(`El estado tiene que ser uno de: ${ESTADOS_RESERVA.join(', ')}.`);
    where.reservation_status = estado;
  }
  if (roomId) where.room_id = asId(roomId, 'La habitación');
  if (desde || hasta) {
    where.check_in_date = {};
    if (desde) where.check_in_date.gte = asDate(desde, 'La fecha desde');
    if (hasta) where.check_in_date.lte = asDate(hasta, 'La fecha hasta');
  }
  return prisma.reservation.findMany({
    where,
    include: incluir,
    orderBy: [{ check_in_date: 'desc' }, { reservation_id: 'desc' }],
  });
};

const obtener = async (id) => {
  const reservationId = asId(id, 'La reserva');
  const reserva = await prisma.reservation.findUnique({
    where: { reservation_id: reservationId },
    include: incluirDetalle,
  });
  if (!reserva) throw noEncontrado('La reserva no existe.');
  return reserva;
};

// RES-09: delega enteramente en fn_process_no_shows() (lee NO_SHOW_HOURS de
// Hotel_Parameter y marca + libera la habitación en una sola sentencia SQL).
const barrerNoShows = async () => {
  const [{ fn_process_no_shows: cantidad }] = await prisma.$queryRaw`SELECT fn_process_no_shows()`;
  return { marcadas: cantidad };
};

module.exports = {
  crear, modificar, cancelar, crearHold, liberarHold, catalogos, listarHuespedes, listarHabitaciones,
  checkIn, checkOut, listar, obtener, barrerNoShows,
};