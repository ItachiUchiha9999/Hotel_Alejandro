const prisma = require('../../db/prisma');
const env = require('../../config/env');
const habitaciones = require('../habitaciones/habitaciones.service');
const { conflicto, invalido, noEncontrado } = require('../../utils/AppError');

const DATOS_INCORRECTOS = 'Los datos de la reserva son incorrectos o no se encontró la reserva.';
const cancelarPosible = (status) => ['PENDIENTE', 'CONFIRMADA'].includes(status);
const incluirReserva = {
  guest: { select: { first_name: true, last_name: true, document_type: true, document_number: true } },
  room: { select: { room_id: true, room_number: true, room_type: { select: { room_type_name: true } } } },
  policy: { select: { policy_name: true, description: true, free_cancel_hours: true, penalty_percentage: true, active: true } },
};

function agruparPorTipo(habitacionesDisponibles) {
  const grupos = new Map();
  for (const habitacion of habitacionesDisponibles) {
    const tipo = habitacion.room_type;
    const grupo = grupos.get(tipo.room_type_id);
    if (grupo) {
      grupo.cantidad_disponible += 1;
    } else {
      grupos.set(tipo.room_type_id, {
        habitacion_id: habitacion.room_id,
        tipo_id: tipo.room_type_id,
        tipo: tipo.room_type_name,
        descripcion: tipo.room_type_description,
        capacidad: tipo.room_type_max_capacity,
        fotografias: [],
        cantidad_disponible: 1,
        precio_por_noche: Number(habitacion.precio_por_noche),
        noches: habitacion.noches,
        total: Number(habitacion.precio_total_estimado),
      });
    }
  }
  return [...grupos.values()];
}

function credenciales(codigo, documento) {
  const code = typeof codigo === 'string' ? codigo.trim().toUpperCase() : '';
  const doc = typeof documento === 'string' ? documento.trim() : '';
  if (!code || code.length > 20 || !doc || doc.length > 30) throw invalido('Ingresá un código y documento válidos.');
  return { code, doc };
}

function calcularPenalidad(policy, checkInDate, total, ahora = new Date()) {
  const horasRestantes = (checkInDate.getTime() - ahora.getTime()) / 3600000;
  const porcentaje = horasRestantes >= policy.free_cancel_hours ? 0 : Number(policy.penalty_percentage);
  return { porcentaje, importe: Math.round(Number(total) * porcentaje) / 100 };
}

// Prisma lee TIME como DateTime (1970-01-01 + hora en UTC).
function horaLlegada(valor) {
  if (!valor) return null;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  return `${String(fecha.getUTCHours()).padStart(2, '0')}:${String(fecha.getUTCMinutes()).padStart(2, '0')}`;
}

async function reservaVerificada(tx, codigo, documento, lock = false) {
  const { code, doc } = credenciales(codigo, documento);
  if (lock) await tx.$queryRaw`SELECT reservation_id FROM "reservation" WHERE reservation_code = ${code} FOR UPDATE`;
  const reserva = await tx.reservation.findFirst({
    where: { reservation_code: { equals: code, mode: 'insensitive' }, guest: { document_number: { equals: doc, mode: 'insensitive' } } },
    include: incluirReserva,
  });
  if (!reserva) throw noEncontrado(DATOS_INCORRECTOS);
  return reserva;
}

async function politicaCancelacion(tx, reserva) {
  let policy = reserva.policy;
  if (!policy) policy = await tx.cancellation_policy.findFirst({ where: { policy_name: 'FLEXIBLE', active: true } });
  if (!policy?.active) throw conflicto('No hay una política de cancelación vigente asociada a esta reserva. Contactá al hotel.');
  const total = Number(reserva.total_amount ?? Number(reserva.price_per_night) * Number(reserva.nights ?? 0));
  const calculo = calcularPenalidad(policy, reserva.check_in_date, total);
  return {
    politica: policy.policy_name,
    condiciones: policy.description,
    horas_cancelacion_sin_cargo: policy.free_cancel_hours,
    porcentaje_penalidad: calculo.porcentaje,
    penalidad: calculo.importe,
  };
}

async function disponibilidad({ desde, hasta, huespedes }) {
  const resultado = await habitaciones.consultarDisponibilidad({
    desde, hasta, capacidad: huespedes, capacidadObligatoria: true,
  });
  // En la web pública, mostrar únicamente la categoría que coincide con el
  // grupo indicado; la consulta administrativa conserva el filtro de capacidad mínima.
  const habitacionesExactas = resultado.habitaciones.filter(
    (habitacion) => habitacion.room_type.room_type_max_capacity === Number(huespedes),
  );
  return {
    contrato: { desde: resultado.filtros.desde, hasta: resultado.filtros.hasta, huespedes: Number(huespedes), noches: resultado.filtros.noches },
    total_tipos: new Set(habitacionesExactas.map((habitacion) => habitacion.room_type.room_type_id)).size,
    total_disponibles: habitacionesExactas.length,
    habitaciones: agruparPorTipo(habitacionesExactas),
  };
}

async function consultarReserva(codigo, documento) {
  let reserva;
  try {
    await prisma.$executeRaw`UPDATE "reservation" SET reservation_status = 'CANCELADA', cancelled_at = CURRENT_TIMESTAMP, cancellation_reason = 'Venció el plazo de confirmación' WHERE reservation_status = 'PENDIENTE' AND pending_expires_at IS NOT NULL AND pending_expires_at <= CURRENT_TIMESTAMP`;
    reserva = await reservaVerificada(prisma, codigo, documento);
  } catch (error) {
    if (error.status === 404) throw noEncontrado(DATOS_INCORRECTOS);
    throw error;
  }
  const [pagos, metodosPago] = await Promise.all([
    prisma.$queryRaw`SELECT rp.amount, rp.paid_at, rp.payment_reference, pm.payment_method
      FROM "reservation_payment" rp JOIN "payment_method" pm ON pm.payment_method_id = rp.payment_method_id
      WHERE rp.reservation_id = ${reserva.reservation_id} ORDER BY rp.paid_at DESC`,
    prisma.payment_method.findMany({ where: { active: true }, select: { payment_method_id: true, payment_method: true }, orderBy: { payment_method_id: 'asc' } }),
  ]);
  const abonado = pagos.reduce((suma, pago) => suma + Number(pago.amount), 0);
  const cancelable = cancelarPosible(reserva.reservation_status) && abonado <= 0.001;
  const cancelacion = cancelable ? await politicaCancelacion(prisma, reserva) : null;
  return {
    codigo: reserva.reservation_code,
    huesped: `${reserva.guest.first_name} ${reserva.guest.last_name}`,
    documento: `${reserva.guest.document_type} ${reserva.guest.document_number}`,
    fecha_ingreso: reserva.check_in_date,
    fecha_salida: reserva.check_out_date,
    hora_llegada: horaLlegada(reserva.arrival_time),
    huespedes: reserva.adults + reserva.children,
    habitacion: reserva.room.room_number,
    tipo_habitacion: reserva.room.room_type.room_type_name,
    total: Number(reserva.total_amount),
    abonado,
    saldo: Math.max(0, Number(reserva.total_amount) - abonado),
    pagos: pagos.map((pago) => {
      const referencia = String(pago.payment_reference || '');
      const ultimosDigitos = pago.payment_method.toUpperCase().includes('TARJETA')
        ? referencia.match(/TARJETA\s+\*{4}(\d{4})/i)?.[1] || null
        : null;
      return {
        importe: Number(pago.amount),
        fecha: pago.paid_at,
        metodo: pago.payment_method,
        tarjeta_ultimos4: ultimosDigitos,
        simulado: referencia.startsWith('SIMULADO WEB:'),
      };
    }),
    medios_pago: metodosPago,
    estado: reserva.reservation_status,
    cancelable,
    cancelacion,
  };
}

async function simularPagoReserva(codigo, documento, paymentMethodId, cardLast4) {
  const metodoId = Number(paymentMethodId);
  if (!Number.isInteger(metodoId) || metodoId <= 0) throw invalido('Elegí un medio de pago válido.');
  try {
    return await prisma.$transaction(async (tx) => {
      const reserva = await reservaVerificada(tx, codigo, documento, true);
      if (reserva.reservation_status !== 'CONFIRMADA') throw conflicto('Solo se pueden simular pagos para reservas confirmadas por el hotel.');
      const metodo = await tx.payment_method.findFirst({ where: { payment_method_id: metodoId, active: true } });
      if (!metodo) throw invalido('El medio de pago seleccionado no está disponible.');
      const esTarjeta = metodo.payment_method.toUpperCase().includes('TARJETA');
      const ultimosDigitos = String(cardLast4 || '').trim();
      if (esTarjeta && !/^\d{4}$/.test(ultimosDigitos)) throw invalido('No se pudieron validar los últimos cuatro dígitos de la tarjeta.');
      const empleado = await tx.employees.findUnique({ where: { employees_id: Number(env.DEFAULT_EMPLOYEE_ID) }, select: { employees_state: true } });
      if (!empleado?.employees_state) throw conflicto('No se pudo registrar el pago de prueba; contactá al hotel.');
      const [acumulado] = await tx.$queryRaw`SELECT COALESCE(SUM(amount), 0)::numeric AS total FROM "reservation_payment" WHERE reservation_id = ${reserva.reservation_id}`;
      const saldo = Math.max(0, Number(reserva.total_amount) - Number(acumulado.total));
      if (saldo <= 0.001) throw conflicto('Esta reserva ya no tiene saldo pendiente.');
      const referencia = esTarjeta
        ? `SIMULADO WEB: TARJETA ****${ultimosDigitos} · PRUEBA-${Date.now()}`
        : `SIMULADO WEB: ${metodo.payment_method} · PRUEBA-${Date.now()}`;
      await tx.$executeRaw`INSERT INTO "reservation_payment" (reservation_id, payment_method_id, amount, payment_reference, employees_id)
        VALUES (${reserva.reservation_id}, ${metodoId}, ${saldo}, ${referencia}, ${Number(env.DEFAULT_EMPLOYEE_ID)})`;
      return { codigo: reserva.reservation_code, importe: saldo, metodo: metodo.payment_method, simulado: true };
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error.code === 'P2034' || (error.code === 'P2010' && ['40001', '40P01'].includes(error.meta?.code))) throw conflicto('El saldo cambió mientras procesábamos el pago de prueba. Volvé a consultar la reserva.');
    throw error;
  }
}

async function cancelarReserva(codigo, documento) {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE "reservation" SET reservation_status = 'CANCELADA', cancelled_at = CURRENT_TIMESTAMP, cancellation_reason = 'Venció el plazo de confirmación' WHERE reservation_status = 'PENDIENTE' AND pending_expires_at IS NOT NULL AND pending_expires_at <= CURRENT_TIMESTAMP`;
      const reserva = await reservaVerificada(tx, codigo, documento, true);
      if (!cancelarPosible(reserva.reservation_status)) throw conflicto(reserva.reservation_status === 'CANCELADA' ? 'Esta reserva ya fue cancelada.' : 'La reserva no se puede cancelar según su estado actual.');
      const [pagos] = await tx.$queryRaw`SELECT COALESCE(SUM(amount), 0)::numeric AS total FROM "reservation_payment" WHERE reservation_id = ${reserva.reservation_id}`;
      if (Number(pagos.total) > 0.001) throw conflicto('La reserva tiene pagos registrados. Contactá al hotel para gestionar cambios o una posible devolución.');
      const penalidad = await politicaCancelacion(tx, reserva);
      const employeeId = Number(env.DEFAULT_EMPLOYEE_ID);
      const empleado = await tx.employees.findUnique({ where: { employees_id: employeeId }, select: { employees_state: true } });
      if (!empleado?.employees_state) throw conflicto('No se pudo registrar la cancelación; contactá al hotel.');
      await tx.reservation.update({
        where: { reservation_id: reserva.reservation_id },
        data: { reservation_status: 'CANCELADA', cancelled_at: new Date(), cancellation_reason: `Cancelación web; penalidad informativa: ${penalidad.penalidad.toFixed(2)}`, employees_id: employeeId },
      });
      return { codigo: reserva.reservation_code, estado: 'CANCELADA', penalidad: penalidad.penalidad };
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error.code === 'P2034' || (error.code === 'P2010' && ['40001', '40P01'].includes(error.meta?.code))) throw conflicto('La reserva cambió durante la operación. Volvé a consultarla.');
    throw error;
  }
}

module.exports = { disponibilidad, consultarReserva, simularPagoReserva, cancelarReserva, credenciales, cancelarPosible, calcularPenalidad, agruparPorTipo };
