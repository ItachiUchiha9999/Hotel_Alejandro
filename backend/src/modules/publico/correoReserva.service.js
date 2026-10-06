const nodemailer = require('nodemailer');
const prisma = require('../../db/prisma');
const env = require('../../config/env');

function mensajeConfirmacion(reserva) {
  const consulta = `${env.PUBLIC_WEB_URL.replace(/\/$/, '')}/web/consulta`;
  const importe = new Intl.NumberFormat('es-AR', { style: 'currency', currency: reserva.moneda }).format(reserva.total);
  return {
    from: env.MAIL_FROM,
    to: { name: `${reserva.nombre} ${reserva.apellido}`, address: reserva.email },
    subject: `Hotel Alejandro I — Reserva ${reserva.codigo}`,
    text: `Hola ${reserva.nombre},\n\nRegistramos tu reserva ${reserva.codigo}.\nEstado: Pendiente de confirmación por el hotel.\nHabitación: ${reserva.tipo}\nIngreso: ${reserva.desde}\nSalida: ${reserva.hasta}\nHuéspedes: ${reserva.huespedes}\nNoches: ${reserva.noches}\nTotal de alojamiento: ${importe}\n\nEl pago se realiza en el hotel. La reserva pendiente vence el ${new Date(reserva.vence).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })} (hora de Argentina) si no se confirma.\nConsultá o cancelá con tu código y documento en ${consulta}.\n\nHotel Alejandro I`,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}

async function procesarCorreos() {
  if (!env.SMTP_HOST || !env.MAIL_FROM) return;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
  });
  // El arrendamiento evita que dos procesos envíen el mismo trabajo a la vez.
  const pendientes = await prisma.$queryRaw`UPDATE reservation_web_request SET
      email_locked_until = CURRENT_TIMESTAMP + INTERVAL '5 minutes', email_attempts = email_attempts + 1
    WHERE request_id IN (SELECT request_id FROM reservation_web_request
      WHERE email_sent_at IS NULL AND email_next_attempt <= CURRENT_TIMESTAMP
        AND (email_locked_until IS NULL OR email_locked_until < CURRENT_TIMESTAMP)
      ORDER BY created_at LIMIT 5 FOR UPDATE SKIP LOCKED)
    RETURNING request_id, confirmation`;
  for (const pendiente of pendientes) {
    try {
      const info = await transport.sendMail(mensajeConfirmacion(pendiente.confirmation));
      if (!info.accepted?.length) throw new Error('SMTP no aceptó el destinatario.');
      await prisma.$executeRaw`UPDATE reservation_web_request SET email_sent_at = CURRENT_TIMESTAMP,
        email_locked_until = NULL WHERE request_id = ${pendiente.request_id}::uuid`;
    } catch (error) {
      // No se exponen datos del huésped ni credenciales en los logs.
      console.error('[correo-reserva] Envío pendiente:', error.code || 'SMTP_ERROR');
      await prisma.$executeRaw`UPDATE reservation_web_request SET email_locked_until = NULL,
        email_next_attempt = CURRENT_TIMESTAMP + INTERVAL '5 minutes' WHERE request_id = ${pendiente.request_id}::uuid`;
    }
  }
}

module.exports = { mensajeConfirmacion, procesarCorreos };
