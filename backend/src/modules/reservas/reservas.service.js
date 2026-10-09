const prisma = require('../../db/prisma');
const { Prisma } = require('@prisma/client');
const { conflicto, invalido, noEncontrado } = require('../../utils/AppError');

const ESTADOS_EDITABLES = ['PENDIENTE', 'CONFIRMADA'];
const HORAS_PENDIENTE = 24;
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
const expirarPendientes = (tx = prisma) => tx.$executeRaw`
  UPDATE "reservation"
  SET reservation_status = 'CANCELADA', cancelled_at = CURRENT_TIMESTAMP,
      cancellation_reason = 'Venció el plazo de confirmación'
  WHERE reservation_status = 'PENDIENTE'
    AND pending_expires_at IS NOT NULL AND pending_expires_at <= CURRENT_TIMESTAMP`;
const validarSolapamiento = async (tx, roomId, ingreso, egreso, excluirId = null) => {
  const rows = await tx.$queryRaw`
    SELECT reservation_id FROM "reservation"
    WHERE room_id = ${roomId} AND reservation_status IN ('PENDIENTE', 'CONFIRMADA', 'IN_HOUSE')
      AND (reservation_status <> 'PENDIENTE' OR pending_expires_at IS NULL OR pending_expires_at > CURRENT_TIMESTAMP)
      AND check_in_date < ${egreso.toISOString().slice(0, 10)}::date AND check_out_date > ${ingreso.toISOString().slice(0, 10)}::date
      ${excluirId ? Prisma.sql`AND reservation_id <> ${excluirId}` : Prisma.empty}
    LIMIT 1`;
  if (rows.length) throw conflicto('La habitación ya está ocupada para esas fechas.');
  const holds = await tx.$queryRaw`
    SELECT hold_id FROM "room_hold"
    WHERE room_id = ${roomId} AND released = FALSE AND expires_at > CURRENT_TIMESTAMP
      AND check_in_date < ${egreso.toISOString().slice(0, 10)}::date AND check_out_date > ${ingreso.toISOString().slice(0, 10)}::date
    LIMIT 1`;
  if (holds.length) throw conflicto('La habitación está retenida temporalmente para esas fechas. Esperá a que venza o liberá la retención.');
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
              active: true,
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

const validarNuevoCliente = (datos) => {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw invalido('Completá los datos del nuevo cliente.');
  const texto = (campo, nombre, maximo, obligatorio = true) => {
    const valor = datos[campo];
    if (valor != null && typeof valor !== 'string') throw invalido(`${nombre} no es válido.`);
    const limpio = (valor || '').trim();
    if ((obligatorio && !limpio) || limpio.length > maximo) throw invalido(`${nombre} es obligatorio y admite hasta ${maximo} caracteres.`);
    return limpio || null;
  };
  const document_type = texto('document_type', 'El tipo de documento', 20).toUpperCase();
  if (!['DNI', 'PASAPORTE', 'CEDULA', 'LC', 'LE'].includes(document_type)) throw invalido('El tipo de documento no es válido.');
  const document_number = texto('document_number', 'El número de documento', 30).toUpperCase();
  const first_name = texto('first_name', 'El nombre', 100);
  const last_name = texto('last_name', 'El apellido', 100);
  const email = texto('email', 'El correo', 150, false);
  const phone = texto('phone', 'El teléfono', 30, false);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalido('El correo electrónico no es válido.');
  return { document_type, document_number, first_name, last_name, email, phone };
};

const crear = async ({ guestId, newGuest, roomId, checkIn, checkOut, status = 'CONFIRMADA', employeeId, adults = 1, children = 0 }) => {
  const esNuevo = newGuest !== undefined && newGuest !== null;
  if (esNuevo && guestId != null && guestId !== '') throw invalido('Elegí un cliente existente o uno nuevo, no ambos.');
  const datosCliente = esNuevo ? validarNuevoCliente(newGuest) : null;
  const guest = esNuevo ? null : asId(guestId, 'El perfil de huésped');
  const roomIdNumber = asId(roomId, 'La habitación');
  const empleado = asId(employeeId, 'El usuario');
  const ingreso = asDate(checkIn, 'La fecha de ingreso');
  const egreso = asDate(checkOut, 'La fecha de egreso');
  validarRango(ingreso, egreso);
  if (!ESTADOS_EDITABLES.includes(status)) throw invalido('El estado inicial debe ser PENDIENTE o CONFIRMADA.');
  try {
  return await prisma.$transaction(async (tx) => {
    await expirarPendientes(tx);
    await validarEmpleado(tx, empleado);
    await liberarVencidas(tx);
    let perfil;
    if (datosCliente) {
      const existente = await tx.guest.findFirst({ where: {
        document_type: { equals: datosCliente.document_type, mode: 'insensitive' },
        document_number: { equals: datosCliente.document_number, mode: 'insensitive' },
      } });
      if (existente) throw conflicto(existente.guest_state
        ? `Ya existe el cliente ${existente.first_name} ${existente.last_name} con ese documento. Seleccionalo en Cliente existente.`
        : 'Ese documento pertenece a un cliente inactivo. Reactivá su perfil antes de reservar.');
      perfil = await tx.guest.create({ data: datosCliente });
    } else {
      perfil = await tx.guest.findUnique({ where: { guest_id: guest } });
    }
    if (!perfil || !perfil.guest_state) throw noEncontrado('El perfil de huésped no existe o está inactivo.');
    const room = await obtenerHabitacionYTarifa(tx, roomIdNumber, ingreso);
    await validarSolapamiento(tx, roomIdNumber, ingreso, egreso);
    const vence = status === 'PENDIENTE'
      ? new Date(Date.now() + HORAS_PENDIENTE * 60 * 60 * 1000)
      : null;
    const [insertada] = await tx.$queryRaw`
      INSERT INTO "reservation" (
        reservation_code, guest_id, room_id, check_in_date, check_out_date,
        adults, children, price_per_night, rate_id, reservation_status,
        reservation_source, employees_id, pending_expires_at
      ) VALUES (
        '', ${perfil.guest_id}, ${roomIdNumber}, ${checkIn}::date, ${checkOut}::date,
        ${Number(adults)}, ${Number(children)}, ${room.base_price}, ${room.rate_id}, ${status},
        'RECEPCION', ${empleado}, ${vence}
      ) RETURNING reservation_id`;
    return tx.reservation.findUnique({ where: { reservation_id: insertada.reservation_id }, include: incluir });
  }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error.code === 'P2002' && esNuevo) throw conflicto('Ya existe un cliente con ese documento. Buscalo en Cliente existente.');
    if (error.code === 'P2034' || (error.code === 'P2010' && ['40001', '40P01'].includes(error.meta?.code))) {
      throw conflicto('Los datos cambiaron mientras guardabas. Volvé a consultar e intentá nuevamente.');
    }
    throw error;
  }
};

const modificar = async (id, datos, employeeId) => {
  const reservationId = asId(id, 'La reserva');
  const empleado = asId(employeeId, 'El usuario');
  return prisma.$transaction(async (tx) => {
    await expirarPendientes(tx);
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
    await expirarPendientes(tx);
    await validarEmpleado(tx, empleado);
    const actual = await tx.reservation.findUnique({ where: { reservation_id: reservationId } });
    if (!actual) throw noEncontrado('La reserva no existe.');
    if (!ESTADOS_EDITABLES.includes(actual.reservation_status)) throw conflicto('No se puede cancelar una reserva que ya tuvo check-in o fue finalizada.');
    return tx.reservation.update({ where: { reservation_id: reservationId }, data: {
      reservation_status: 'CANCELADA', cancellation_reason: motivo, cancelled_at: new Date(), employees_id: empleado,
    }, include: incluir });
  }, { isolationLevel: 'Serializable' });
};

const confirmar = async (id, employeeId) => {
  const reservationId = asId(id, 'La reserva');
  const empleado = asId(employeeId, 'El usuario');
  return prisma.$transaction(async (tx) => {
    await validarEmpleado(tx, empleado);
    await expirarPendientes(tx);
    await tx.$queryRaw`SELECT reservation_id FROM "reservation" WHERE reservation_id = ${reservationId} FOR UPDATE`;
    const reserva = await tx.reservation.findUnique({ where: { reservation_id: reservationId } });
    if (!reserva) throw noEncontrado('La reserva no existe.');
    if (reserva.reservation_status !== 'PENDIENTE') {
      throw conflicto(`Solo se pueden confirmar reservas pendientes. Estado actual: ${reserva.reservation_status}.`);
    }
    await tx.$executeRaw`
      UPDATE "reservation"
      SET reservation_status = 'CONFIRMADA', pending_expires_at = NULL, employees_id = ${empleado}
      WHERE reservation_id = ${reservationId}`;
    return tx.reservation.findUnique({ where: { reservation_id: reservationId }, include: incluir });
  }, { isolationLevel: 'Serializable' });
};

const crearHold = async ({ roomId, checkIn, checkOut, employeeId }) => {
  const room = asId(roomId, 'La habitación');
  const empleado = asId(employeeId, 'El usuario');
  const ingreso = asDate(checkIn, 'La fecha de ingreso');
  const egreso = asDate(checkOut, 'La fecha de egreso');
  validarRango(ingreso, egreso);
  return prisma.$transaction(async (tx) => {
    await expirarPendientes(tx);
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
  select: { room_id: true, room_number: true, room_state: true, room_type: { select: { room_type_id: true, room_type_name: true } } }, orderBy: { room_number: 'asc' },
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

const checkIn = async (id, { employeeId, actualAdults, actualChildren, observations, guests = [] } = {}) => {
  const reservationId = asId(id, 'La reserva');
  const empleado = asId(employeeId, 'El usuario');

  return prisma.$transaction(async (tx) => {
    await validarEmpleado(tx, empleado);

    const reserva = await tx.reservation.findUnique({
      where: { reservation_id: reservationId },
      include: { guest: { select: { document_type: true, document_number: true, first_name: true, last_name: true } } },
    });
    if (!reserva) throw noEncontrado('La reserva no existe.');
    if (reserva.reservation_status !== 'CONFIRMADA') {
      throw conflicto(`Solo se puede hacer check-in de una reserva confirmada. Estado actual: ${reserva.reservation_status}.`);
    }
    const hoy = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    if (hoy < reserva.check_in_date) {
      throw conflicto(`El check-in no puede registrarse antes del ${reserva.check_in_date.toISOString().slice(0, 10)}.`);
    }

    if (!Array.isArray(guests)) throw invalido('La lista de huéspedes no es válida.');
    const adultosFinales = actualAdults ?? reserva.adults;
    const menoresFinales = actualChildren ?? reserva.children;
    if (!Number.isInteger(adultosFinales) || adultosFinales < 1 || !Number.isInteger(menoresFinales) || menoresFinales < 0) {
      throw invalido('La cantidad de adultos y menores no es válida.');
    }
    const habitacion = await tx.room.findUnique({
      where: { room_id: reserva.room_id }, include: { room_type: true },
    });
    if (!habitacion || !habitacion.active) throw conflicto('La habitación no existe o está inactiva.');
    const tipo = habitacion.room_type;
    if (adultosFinales + menoresFinales > tipo.room_type_max_capacity
      || (tipo.max_adults != null && adultosFinales > tipo.max_adults)) {
      throw invalido('Los huéspedes que ingresan superan la capacidad o el máximo de adultos de la habitación.');
    }
    const huespedes = [{ ...reserva.guest, guest_role: 'TITULAR', person_type: 'ADULTO' }, ...guests.map((guest) => {
      if (!guest || typeof guest !== 'object' || Array.isArray(guest)) throw invalido('Los datos del huésped no son válidos.');
      const personType = String(guest.personType ?? 'ADULTO').trim().toUpperCase();
      const documentType = String(guest.documentType ?? '').trim().toUpperCase();
      const documentNumber = String(guest.documentNumber ?? '').trim();
      const firstName = String(guest.firstName ?? '').trim();
      const lastName = String(guest.lastName ?? '').trim();
      if (!['ADULTO', 'MENOR'].includes(personType) || !['DNI', 'PASAPORTE', 'CEDULA', 'LC', 'LE'].includes(documentType) || !documentNumber || !firstName || !lastName) {
        throw invalido('Cada huésped adicional requiere nombre, apellido y documento válido.');
      }
      if (documentNumber.length > 30 || firstName.length > 100 || lastName.length > 100) {
        throw invalido('El documento admite hasta 30 caracteres y el nombre y apellido hasta 100 cada uno.');
      }
      return { document_type: documentType, document_number: documentNumber, first_name: firstName, last_name: lastName, guest_role: 'ACOMPANANTE', person_type: personType };
    })];
    if (huespedes.length !== adultosFinales + menoresFinales) {
      throw invalido(`Registrá los datos de los ${adultosFinales + menoresFinales} huéspedes que ingresan (incluido el titular).`);
    }
    if (huespedes.filter((h) => h.person_type === 'ADULTO').length !== adultosFinales
      || huespedes.filter((h) => h.person_type === 'MENOR').length !== menoresFinales) {
      throw invalido('Las categorías de edad de los huéspedes deben coincidir con las cantidades de adultos y menores.');
    }
    const duplicados = new Set(huespedes.map((h) => `${h.document_type}:${h.document_number.toLowerCase()}`));
    if (duplicados.size !== huespedes.length) throw invalido('No se puede registrar dos veces el mismo documento en esta habitación.');

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

    for (const huesped of huespedes) {
      await tx.$executeRaw`
        INSERT INTO "reservation_stay_guest" (
          reservation_id, guest_role, person_type, document_type, document_number,
          first_name, last_name, employees_id
        ) VALUES (
          ${reservationId}, ${huesped.guest_role}, ${huesped.person_type}, ${huesped.document_type}, ${huesped.document_number},
          ${huesped.first_name}, ${huesped.last_name}, ${empleado}
        )`;
    }
    const actualizada = await tx.reservation.findUnique({ where: { reservation_id: reservationId }, include: incluir });
    const huespedesRegistrados = await tx.$queryRaw`
      SELECT stay_guest_id, guest_role, person_type, document_type, document_number, first_name, last_name, recorded_at
      FROM "reservation_stay_guest" WHERE reservation_id = ${reservationId} ORDER BY stay_guest_id`;
    return { ...actualizada, stay_guests: huespedesRegistrados };
  }, { isolationLevel: 'Serializable' });
};

const checkOut = async (id, { employeeId, settleServiceCharges = false, serviceChargeIds, pendingDetail, observations, paymentMethodId, paymentReference } = {}) => {
  const reservationId = asId(id, 'La reserva');
  const empleado = asId(employeeId, 'El usuario');

  return prisma.$transaction(async (tx) => {
    await validarEmpleado(tx, empleado);

    await tx.$queryRaw`
      SELECT reservation_id FROM "reservation"
      WHERE reservation_id = ${reservationId} FOR UPDATE`;

    const reserva = await tx.reservation.findUnique({ where: { reservation_id: reservationId } });
    if (!reserva) throw noEncontrado('La reserva no existe.');
    if (reserva.reservation_status !== 'IN_HOUSE') {
      throw conflicto(`Solo se puede hacer check-out de una reserva con check-in realizado. Estado actual: ${reserva.reservation_status}.`);
    }

    const cargosAntesDeCerrar = await tx.$queryRaw`
      SELECT charge_id FROM "room_service_charge"
      WHERE reservation_id = ${reservationId} AND paid_at IS NULL
      ORDER BY charge_id`;
    if (Array.isArray(serviceChargeIds)) {
      const actuales = cargosAntesDeCerrar.map((cargo) => Number(cargo.charge_id)).sort((a, b) => a - b);
      const revisados = serviceChargeIds.map(Number).sort((a, b) => a - b);
      if (actuales.length !== revisados.length || actuales.some((chargeId, index) => chargeId !== revisados[index])) {
        throw conflicto('El folio cambió desde que lo consultaste. Cerrá esta ventana y volvé a abrir el check-out para revisar los cargos actualizados.');
      }
    }

    if (settleServiceCharges) {
      const metodoId = asId(paymentMethodId, 'El medio de pago');
      const metodo = await tx.payment_method.findUnique({ where: { payment_method_id: metodoId } });
      if (!metodo || !metodo.active) throw invalido('El medio de pago no existe o está inactivo.');
      const referencia = String(paymentReference || '').trim();
      if (metodo.requires_reference && !referencia) throw invalido('Este medio de pago requiere número de referencia.');
      await tx.$executeRaw`
        UPDATE "room_service_charge"
        SET paid_at = CURRENT_TIMESTAMP, paid_by = ${empleado}, payment_method_id = ${metodoId}, payment_reference = ${referencia || null}
        WHERE reservation_id = ${reservationId} AND paid_at IS NULL`;
    }

    const cargosPendientes = await tx.$queryRaw`
      SELECT service_name, quantity, total_amount FROM "room_service_charge"
      WHERE reservation_id = ${reservationId} AND paid_at IS NULL
      ORDER BY charged_at, charge_id`;
    const totalServiciosPendientes = cargosPendientes.reduce((total, cargo) => total + Number(cargo.total_amount), 0);
    const detalleServicios = cargosPendientes.length
      ? `Servicios de habitación sin cobrar (${cargosPendientes.length}, total $${totalServiciosPendientes.toFixed(2)}): ${cargosPendientes.map((cargo) => `${cargo.quantity}× ${cargo.service_name}`).join(', ')}`
      : null;
    const tieneCargosPendientes = cargosPendientes.length > 0;
    if (tieneCargosPendientes && !String(pendingDetail || '').trim()) {
      throw invalido('Indicá el motivo por el que los cargos de habitación quedan pendientes.');
    }

    try {
      await tx.reservation_check_out.create({
        data: {
          reservation_id: reservationId,
          employees_id: empleado,
          pending_charges: tieneCargosPendientes,
          pending_detail: tieneCargosPendientes ? `${String(pendingDetail).trim()} — ${detalleServicios}` : null,
          observations: observations || null,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') throw conflicto('Esta reserva ya tiene un check-out registrado.');
      throw error;
    }

    const actualizada = await tx.reservation.findUnique({ where: { reservation_id: reservationId }, include: incluir });
    return {
      ...actualizada,
      pending_service_charges: cargosPendientes,
      check_out_pending_charges: tieneCargosPendientes,
    };
  }, { isolationLevel: 'Serializable' });
};

const pagosAlojamiento = async (id) => {
  const reservationId = asId(id, 'La reserva');
  const reserva = await prisma.reservation.findUnique({ where: { reservation_id: reservationId } });
  if (!reserva) throw noEncontrado('La reserva no existe.');
  const pagos = await prisma.$queryRaw`
    SELECT rp.reservation_payment_id, rp.amount, rp.paid_at, rp.payment_reference,
           pm.payment_method, e.employees_name, e.employees_lastname
    FROM "reservation_payment" rp
    JOIN "payment_method" pm ON pm.payment_method_id = rp.payment_method_id
    JOIN "employees" e ON e.employees_id = rp.employees_id
    WHERE rp.reservation_id = ${reservationId}
    ORDER BY rp.paid_at DESC, rp.reservation_payment_id DESC`;
  const abonado = pagos.reduce((sum, pago) => sum + Number(pago.amount), 0);
  const total = Number(reserva.total_amount ?? 0);
  return { reservation_id: reservationId, total_alojamiento: total, abonado, saldo: Math.max(0, total - abonado), pagos };
};

const registrarPagoAlojamiento = async (id, { amount, paymentMethodId, paymentReference, employeeId } = {}) => {
  const reservationId = asId(id, 'La reserva');
  const empleado = asId(employeeId, 'El usuario');
  const metodoId = asId(paymentMethodId, 'El medio de pago');
  const importe = Number(amount);
  if (!Number.isFinite(importe) || importe <= 0 || Math.round(importe * 100) !== importe * 100) {
    throw invalido('El importe debe ser positivo y tener como máximo dos decimales.');
  }
  const referencia = String(paymentReference || '').trim();
  if (referencia.length > 100) throw invalido('La referencia no puede superar 100 caracteres.');

  await prisma.$transaction(async (tx) => {
    await validarEmpleado(tx, empleado);
    const [reserva] = await tx.$queryRaw`
      SELECT reservation_id, reservation_status, total_amount
      FROM "reservation" WHERE reservation_id = ${reservationId} FOR UPDATE`;
    if (!reserva) throw noEncontrado('La reserva no existe.');
    if (!['IN_HOUSE', 'FINALIZADA'].includes(reserva.reservation_status)) throw conflicto('Los pagos de alojamiento se registran desde el check-in hasta después del check-out.');
    const metodo = await tx.payment_method.findUnique({ where: { payment_method_id: metodoId } });
    if (!metodo || !metodo.active) throw invalido('El medio de pago no existe o está inactivo.');
    if (metodo.requires_reference && !referencia) throw invalido('Este medio de pago requiere número de referencia.');
    const [acumulado] = await tx.$queryRaw`
      SELECT COALESCE(SUM(amount), 0)::numeric AS total
      FROM "reservation_payment" WHERE reservation_id = ${reservationId}`;
    const saldo = Number(reserva.total_amount) - Number(acumulado.total);
    if (importe > saldo + 0.001) throw conflicto(`El pago supera el saldo de alojamiento. Saldo pendiente: $${Math.max(0, saldo).toFixed(2)}.`);
    await tx.$executeRaw`
      INSERT INTO "reservation_payment" (reservation_id, payment_method_id, amount, payment_reference, employees_id)
      VALUES (${reservationId}, ${metodoId}, ${importe}, ${referencia || null}, ${empleado})`;
  }, { isolationLevel: 'Serializable' });

  return pagosAlojamiento(reservationId);
};

// Listado y detalle (pantalla de recepción). Filtros opcionales.
const listar = async ({ estado, roomId, desde, hasta } = {}) => {
  await expirarPendientes();
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
  const reservas = await prisma.reservation.findMany({
    where,
    include: incluir,
    orderBy: [{ check_in_date: 'desc' }, { reservation_id: 'desc' }],
  });
  const pendientes = await prisma.$queryRaw`
    SELECT reservation_id, pending_expires_at FROM "reservation"
    WHERE pending_expires_at IS NOT NULL`;
  const vencimientos = new Map(pendientes.map((r) => [r.reservation_id, r.pending_expires_at]));
  return reservas.map((reserva) => ({
    ...reserva,
    pending_expires_at: vencimientos.get(reserva.reservation_id) ?? null,
  }));
};

const obtener = async (id) => {
  const reservationId = asId(id, 'La reserva');
  const reserva = await prisma.reservation.findUnique({
    where: { reservation_id: reservationId },
    include: incluirDetalle,
  });
  if (!reserva) throw noEncontrado('La reserva no existe.');
  const huespedes = await prisma.$queryRaw`
    SELECT stay_guest_id, guest_role, person_type, document_type, document_number, first_name, last_name, recorded_at
    FROM "reservation_stay_guest" WHERE reservation_id = ${reservationId} ORDER BY stay_guest_id`;
  return { ...reserva, stay_guests: huespedes };
};

// RES-09: delega enteramente en fn_process_no_shows() (lee NO_SHOW_HOURS de
// Hotel_Parameter y marca + libera la habitación en una sola sentencia SQL).
const barrerNoShows = async () => {
  const [{ fn_process_no_shows: cantidad }] = await prisma.$queryRaw`SELECT fn_process_no_shows()`;
  return { marcadas: cantidad };
};

module.exports = {
  crear, modificar, cancelar, confirmar, crearHold, liberarHold, catalogos, listarHuespedes, listarHabitaciones, expirarPendientes,
  checkIn, checkOut, pagosAlojamiento, registrarPagoAlojamiento, listar, obtener, barrerNoShows,
};
