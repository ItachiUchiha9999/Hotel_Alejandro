const prisma = require('../../db/prisma');
const { conflicto, invalido, noEncontrado } = require('../../utils/AppError');

const asId = (val, label) => {
  const n = Number(val);
  if (!Number.isInteger(n) || n <= 0) throw invalido(`${label} no es válido.`);
  return n;
};

const asDate = (val, label) => {
  if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    throw invalido(`${label} debe tener formato AAAA-MM-DD.`);
  }
  const date = new Date(`${val}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== val) {
    throw invalido(`${label} no es una fecha válida.`);
  }
  return date;
};

/**
 * Registra un bloqueo por Mantenimiento, Limpieza o Fuera de servicio.
 * El trigger `tr_sync_room_maintenance` en Postgres pasa automáticamente
 * la habitación al estado correspondiente.
 * El trigger `tr_check_maintenance_vs_reservation` impide bloquear si hay reservas.
 */
const registrarBloqueo = async ({ roomId, tipo = 'MANTENIMIENTO', fechaInicio, fechaFinEstimada, motivo, employeeId }) => {
  const idHabitacion = asId(roomId, 'La habitación');
  const empleado = asId(employeeId, 'El empleado');
  const inicio = asDate(fechaInicio, 'La fecha de inicio');
  const fin = asDate(fechaFinEstimada, 'La fecha estimada de fin');

  if (fin < inicio) {
    throw invalido('La fecha de fin estimada no puede ser anterior a la de inicio.');
  }

  const tiposPermitidos = ['LIMPIEZA', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO'];
  if (!tiposPermitidos.includes(tipo)) {
    throw invalido(`El tipo debe ser uno de: ${tiposPermitidos.join(', ')}.`);
  }

  const razon = String(motivo || '').trim();
  if (!razon) throw invalido('El motivo del bloqueo es obligatorio.');

  return prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({ where: { room_id: idHabitacion } });
    if (!room) throw noEncontrado('La habitación no existe.');

    try {
      return await tx.room_maintenance.create({
        data: {
          room_id: idHabitacion,
          maintenance_type: tipo,
          start_date: inicio,
          estimated_end_date: fin,
          reason: razon,
          opened_by: empleado,
        },
        include: {
          room: { select: { room_id: true, room_number: true, room_status: true } },
        },
      });
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('tr_check_maintenance_vs_reservation') || msg.includes('tiene la reserva')) {
        throw conflicto('La habitación tiene reservas activas en esas fechas. Reubicala antes de bloquearla.');
      }
      if (msg.includes('ex_maintenance_no_overlap')) {
        throw conflicto('Ya existe un período de mantenimiento abierto para esta habitación.');
      }
      if (msg.includes('La habitación está ocupada')) {
        throw conflicto('La habitación está ocupada por un huésped. No se puede bloquear hasta el check-out.');
      }
      throw err;
    }
  });
};

/**
 * Cierra un mantenimiento abierto.
 * El trigger `tr_sync_room_maintenance` devuelve la habitación a 'DISPONIBLE'.
 */
const cerrarBloqueo = async (maintenanceId, { fechaFinReal, notasCierre, employeeId }) => {
  const id = asId(maintenanceId, 'El registro de mantenimiento');
  const empleado = asId(employeeId, 'El empleado');
  const finReal = fechaFinReal ? asDate(fechaFinReal, 'La fecha real de finalización') : new Date();

  return prisma.$transaction(async (tx) => {
    const actual = await tx.room_maintenance.findUnique({ where: { maintenance_id: id } });
    if (!actual) throw noEncontrado('El registro de mantenimiento no existe.');
    if (actual.actual_end_date !== null) {
      throw conflicto('Este bloqueo ya se encuentra cerrado.');
    }

    return tx.room_maintenance.update({
      where: { maintenance_id: id },
      data: {
        actual_end_date: finReal,
        closing_notes: notasCierre ? String(notasCierre).trim() : 'Trabajo completado',
        closed_by: empleado,
      },
      include: {
        room: { select: { room_id: true, room_number: true, room_status: true } },
      },
    });
  });
};

/**
 * Lista los mantenimientos (activos por defecto o históricos).
 */
const listar = async ({ roomId, soloAbiertos = true } = {}) => {
  const where = {};
  if (roomId) where.room_id = asId(roomId, 'La habitación');
  if (soloAbiertos) where.actual_end_date = null;

  return prisma.room_maintenance.findMany({
    where,
    include: {
      room: { select: { room_id: true, room_number: true, room_status: true } },
    },
    orderBy: { start_date: 'desc' },
  });
};

module.exports = { registrarBloqueo, cerrarBloqueo, listar };