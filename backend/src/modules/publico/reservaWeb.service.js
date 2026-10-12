const { createHash } = require('node:crypto');
const prisma = require('../../db/prisma');
const env = require('../../config/env');
const { invalido, conflicto } = require('../../utils/AppError');

const fechaHoy = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

function validarSolicitud(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalido('La solicitud no es válida.');
  const texto = (campo, etiqueta, max) => {
    if (typeof body[campo] !== 'string' || !body[campo].trim() || body[campo].trim().length > max) {
      throw invalido(`${etiqueta} es obligatorio y admite hasta ${max} caracteres.`);
    }
    return body[campo].trim();
  };
  const requestId = texto('requestId', 'El identificador de solicitud', 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw invalido('La solicitud no es válida. Volvé a abrir el formulario.');
  }
  const nombre = texto('nombre', 'El nombre', 100);
  const apellido = texto('apellido', 'El apellido', 100);
  const tipoDocumento = texto('tipoDocumento', 'El tipo de documento', 20).toUpperCase();
  if (!['DNI', 'PASAPORTE', 'CEDULA', 'LC', 'LE'].includes(tipoDocumento)) throw invalido('El tipo de documento no es válido.');
  const documento = texto('documento', 'El documento', 30).toUpperCase();
  const email = texto('email', 'El correo electrónico', 150).toLowerCase();
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) throw invalido('Ingresá un correo electrónico válido.');
  const telefono = texto('telefono', 'El teléfono', 30);
  if (!/^[+\d().\s-]+$/.test(telefono) || telefono.replace(/\D/g, '').length < 6) throw invalido('Ingresá un teléfono válido.');
  // Hora de llegada estimada (franja en punto). Es opcional: las
  // reservas de recepción no la informan.
  let horaLlegada = null;
  if (body.horaLlegada !== undefined && body.horaLlegada !== null && body.horaLlegada !== '') {
    if (typeof body.horaLlegada !== 'string' || !/^([01]\d|2[0-3]):00$/.test(body.horaLlegada.trim())) {
      throw invalido('La hora de llegada debe ser una franja horaria en punto, de 00:00 a 23:00.');
    }
    horaLlegada = body.horaLlegada.trim();
  }
  // Pedidos especiales (opcional): cuna, piso alto, celebración...
  let observaciones = null;
  if (body.observaciones !== undefined && body.observaciones !== null && body.observaciones !== '') {
    if (typeof body.observaciones !== 'string' || body.observaciones.trim().length > 255) {
      throw invalido('Las observaciones admiten hasta 255 caracteres.');
    }
    observaciones = body.observaciones.trim();
  }
  const desde = texto('desde', 'La fecha de ingreso', 10);
  const hasta = texto('hasta', 'La fecha de salida', 10);
  for (const value of [desde, hasta]) {
    const date = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw invalido('Ingresá fechas válidas.');
  }
  if (hasta <= desde) throw invalido('La salida debe ser posterior al ingreso.');
  if (desde < fechaHoy()) throw invalido('La fecha de ingreso no puede estar en el pasado.');
  const tipoId = Number(body.tipoId);
  const huespedes = Number(body.huespedes);
  const precioEsperado = Number(body.precioEsperado);
  if (!Number.isInteger(tipoId) || tipoId <= 0) throw invalido('Elegí un tipo de habitación válido.');
  if (!Number.isInteger(huespedes) || huespedes < 1 || huespedes > 20) throw invalido('La cantidad de huéspedes debe estar entre 1 y 20.');
  if (!Number.isFinite(precioEsperado) || precioEsperado <= 0) throw invalido('Volvé a consultar el precio de la habitación.');
  return { requestId, nombre, apellido, tipoDocumento, documento, email, telefono, desde, hasta, tipoId, huespedes, precioEsperado, horaLlegada, observaciones };
}

async function crearReservaWeb(body) {
  const datos = validarSolicitud(body);
  const { requestId, ...contenido } = datos;
  const hash = createHash('sha256').update(JSON.stringify(contenido)).digest('hex');
  // Repetir una solicitud tras perder la respuesta no debe crear otra reserva.
  for (let intento = 0; intento < 3; intento += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${requestId}, 0))`;
        const [previa] = await tx.$queryRaw`SELECT * FROM reservation_web_request WHERE request_id = ${requestId}::uuid`;
        if (previa) {
          if (previa.payload_hash !== hash) throw conflicto('Esta solicitud ya fue usada con otros datos. Volvé a buscar disponibilidad.');
          return { ...previa.confirmation, correo: previa.email_sent_at ? 'ENVIADO' : 'PENDIENTE' };
        }
        const empleado = await tx.employees.findUnique({ where: { employees_id: env.DEFAULT_EMPLOYEE_ID } });
        if (!empleado?.employees_state) throw conflicto('No se puede registrar la reserva en este momento. Contactá al hotel.');
        // Serializa las asignaciones de este tipo y revalida con la misma función de ECO-01.
        await tx.$queryRaw`SELECT room_type_id FROM room_type WHERE room_type_id = ${datos.tipoId} FOR UPDATE`;
        await tx.$executeRaw`UPDATE reservation SET reservation_status = 'CANCELADA', cancelled_at = CURRENT_TIMESTAMP,
          cancellation_reason = 'Venció el plazo de confirmación' WHERE reservation_status = 'PENDIENTE'
          AND pending_expires_at IS NOT NULL AND pending_expires_at <= CURRENT_TIMESTAMP`;
        const disponibles = await tx.$queryRaw`SELECT * FROM fn_available_rooms(${datos.desde}::date, ${datos.hasta}::date, ${datos.huespedes}::smallint)
          WHERE room_type_id = ${datos.tipoId} ORDER BY room_id`;
        if (!disponibles.length) throw conflicto('El tipo elegido ya no tiene disponibilidad. Volvé a buscar otra opción.');
        const room = disponibles[0];
        if (Math.abs(Number(room.price_per_night) - datos.precioEsperado) > 0.001) throw conflicto('La tarifa cambió desde tu búsqueda. Volvé a consultar para aceptar el precio actualizado.');
        await tx.$queryRaw`SELECT room_id FROM room WHERE room_id = ${room.room_id} FOR UPDATE`;
        // El documento identifica un perfil existente. No se sobrescriben sus datos personales.
        const claveDocumento = `${datos.tipoDocumento}:${datos.documento}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${claveDocumento}, 1))`;
        let guest = await tx.guest.findFirst({ where: {
          document_type: { equals: datos.tipoDocumento, mode: 'insensitive' },
          document_number: { equals: datos.documento, mode: 'insensitive' },
        } });
        if (guest && !guest.guest_state) throw conflicto('No se pudo registrar la reserva con estos datos. Contactá al hotel.');
        if (!guest) guest = await tx.guest.create({ data: {
          first_name: datos.nombre, last_name: datos.apellido, document_type: datos.tipoDocumento,
          document_number: datos.documento, email: datos.email, phone: datos.telefono,
        } });
        const policy = await tx.cancellation_policy.findFirst({ where: { policy_name: 'FLEXIBLE', active: true } });
        if (!policy) throw conflicto('No hay una política de cancelación disponible. Contactá al hotel.');
        const [rate] = await tx.$queryRaw`SELECT rate_id, currency FROM room_type_rate WHERE room_type_id = ${datos.tipoId}
          AND active AND valid_from <= ${datos.desde}::date AND (valid_to IS NULL OR valid_to > ${datos.desde}::date)
          ORDER BY valid_from DESC LIMIT 1`;
        if (!rate) throw conflicto('La tarifa ya no está disponible. Volvé a consultar.');
        const [reserva] = await tx.$queryRaw`INSERT INTO reservation
          (reservation_code, guest_id, room_id, check_in_date, check_out_date, adults, children,
           price_per_night, rate_id, policy_id, reservation_status, reservation_source, employees_id, pending_expires_at, arrival_time, observations)
          VALUES ('', ${guest.guest_id}, ${room.room_id}, ${datos.desde}::date, ${datos.hasta}::date, ${datos.huespedes}, 0,
            ${room.price_per_night}, ${rate.rate_id}, ${policy.policy_id}, 'PENDIENTE', 'WEB', ${env.DEFAULT_EMPLOYEE_ID},
            CURRENT_TIMESTAMP + INTERVAL '24 hours', ${datos.horaLlegada || null}::time, ${datos.observaciones || null}) RETURNING reservation_id, reservation_code, total_amount, pending_expires_at`;
        const confirmation = {
          codigo: reserva.reservation_code, nombre: datos.nombre, apellido: datos.apellido,
          email: datos.email, telefono: datos.telefono, tipo: room.room_type_name, desde: datos.desde,
          hasta: datos.hasta, hora_llegada: datos.horaLlegada, huespedes: datos.huespedes, noches: Number(room.nights),
          precio_por_noche: Number(room.price_per_night), total: Number(reserva.total_amount), moneda: rate.currency,
          estado: 'PENDIENTE', vence: reserva.pending_expires_at.toISOString(),
        };
        await tx.$executeRaw`INSERT INTO reservation_web_request(request_id, payload_hash, reservation_id, confirmation)
          VALUES (${requestId}::uuid, ${hash}, ${reserva.reservation_id}, ${JSON.stringify(confirmation)}::jsonb)`;
        return { ...confirmation, correo: 'PENDIENTE' };
      }, { isolationLevel: 'Serializable', timeout: 15000 });
    } catch (error) {
      const codigo = error.meta?.code || error.code;
      if (['P2034', '40001', '40P01', '23P01', '23505', 'P2002'].includes(codigo)) {
        if (intento < 2) continue;
        throw conflicto('La disponibilidad cambió mientras reservabas. Volvé a consultar e intentá nuevamente.');
      }
      throw error;
    }
  }
}

module.exports = { validarSolicitud, crearReservaWeb };
