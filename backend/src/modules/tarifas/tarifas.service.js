const prisma = require('../../db/prisma');
const { Prisma } = require('@prisma/client');
const { noEncontrado, conflicto, invalido } = require('../../utils/AppError');
const { toId, toText } = require('../../utils/parse');

const TEMPORADAS = new Set(['GENERAL', 'ALTA', 'BAJA', 'ESPECIAL']);

const presentarTarifa = (tarifa) => tarifa && ({
  ...tarifa,
  employee: tarifa.employee,
  employees: tarifa.employee,
});

const fechaValida = (value, nombre = 'fecha') => {
  const text = String(value ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw invalido(`La ${nombre} no es válida.`);
  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw invalido(`La ${nombre} no es válida.`);
  }
  return { text, parsed };
};

const fechaLocalHoy = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const PRECIO_SQL = `
  SELECT rr.rate_id, rr.room_type_id, rr.base_price, rr.currency, rr.valid_from,
         rr.valid_to, rr.season_name, rr.reason, rr.employees_id, rr.creation_date,
         jsonb_build_object(
           'room_type_id', rt.room_type_id, 'room_type_name', rt.room_type_name,
           'room_type_max_capacity', rt.max_capacity,
           'room_type_state', rt.active
         ) AS room_type,
         jsonb_build_object(
           'employees_id', e.employees_id, 'employees_name', e.employees_name,
           'employees_lastname', e.employees_lastname
         ) AS employee
  FROM "room_type_rate" rr
  JOIN "room_type" rt ON rt.room_type_id = rr.room_type_id
  JOIN "employees" e ON e.employees_id = rr.employees_id`;

const listar = async ({ tipo, soloVigentes = false } = {}) => {
  const tipoId = toId(tipo);
  const soloActuales = soloVigentes === true || soloVigentes === 'true' || soloVigentes === '1';
  const hoy = fechaLocalHoy();
  const filas = await prisma.$queryRaw`
    ${Prisma.raw(PRECIO_SQL)}
    WHERE (${tipoId}::int IS NULL OR rr.room_type_id = ${tipoId})
      AND (NOT ${soloActuales}::boolean OR (rr.valid_from <= ${hoy}::date AND (rr.valid_to IS NULL OR rr.valid_to > ${hoy}::date)))
    ORDER BY rr.valid_from DESC, rr.rate_id DESC`;
  return filas.map(presentarTarifa);
};

const obtener = async (id) => {
  const rateId = toId(id);
  if (!rateId) throw invalido('El identificador de la tarifa no es válido.');
  const filas = await prisma.$queryRaw`
    ${Prisma.raw(PRECIO_SQL)} WHERE rr.rate_id = ${rateId}`;
  if (!filas.length) throw noEncontrado('La tarifa no existe.');
  return presentarTarifa(filas[0]);
};

const crear = async (datos = {}, actorEmployeeId = 1) => {
  const tipoId = toId(datos.room_type_id ?? datos.roomTypeId ?? datos.tipo);
  if (!tipoId) throw invalido('Elegí un tipo de habitación.');

  const precio = Number(datos.base_price ?? datos.precioBase ?? datos.precio);
  if (!Number.isFinite(precio) || precio <= 0) throw invalido('El precio debe ser un número mayor que cero.');

  const moneda = toText(datos.currency ?? datos.moneda ?? 'ARS')?.toUpperCase();
  if (!moneda || !/^[A-Z]{3}$/.test(moneda)) throw invalido('La moneda debe tener exactamente 3 caracteres, por ejemplo ARS.');

  const { text: fechaTexto } = fechaValida(datos.valid_from ?? datos.fecha_desde ?? datos.fechaInicio ?? fechaLocalHoy(), 'fecha de vigencia');
  if (fechaTexto < fechaLocalHoy()) throw invalido('La fecha de vigencia debe ser hoy o futura para conservar el historial de precios.');

  const temporada = (toText(datos.season_name ?? datos.temporada) ?? 'GENERAL').toUpperCase();
  if (!TEMPORADAS.has(temporada)) throw invalido('Elegí una temporada general, alta, baja o especial.');
  const motivo = toText(datos.reason ?? datos.motivo);
  if (motivo && motivo.length > 255) throw invalido('El motivo no puede superar 255 caracteres.');
  const empleadoId = toId(datos.employees_id ?? datos.employeeId) || toId(actorEmployeeId) || 1;

  const tipo = await prisma.room_type.findUnique({ where: { room_type_id: tipoId } });
  if (!tipo) throw invalido('El tipo de habitación elegido no existe.');
  if (!tipo.room_type_state) throw conflicto(`El tipo "${tipo.room_type_name}" está inactivo y no puede recibir una nueva tarifa.`);
  const empleado = await prisma.employees.findUnique({ where: { employees_id: empleadoId } });
  if (!empleado || !empleado.employees_state) throw invalido('El usuario responsable no existe o está inactivo.');

  try {
    return await prisma.$transaction(async (tx) => {
      const ultima = await tx.$queryRaw`
        SELECT valid_from FROM "room_type_rate"
        WHERE room_type_id = ${tipoId}
        ORDER BY valid_from DESC, rate_id DESC
        LIMIT 1 FOR UPDATE`;
      if (ultima.length && fechaTexto <= ultima[0].valid_from.toISOString().slice(0, 10)) {
        throw conflicto('La fecha debe ser posterior a la última tarifa registrada para este tipo de habitación.');
      }

      // El trigger existente cierra la tarifa abierta anterior en esta fecha.
      const filas = await tx.$queryRaw`
        INSERT INTO "room_type_rate"
          (room_type_id, base_price, currency, valid_from, season_name, reason, employees_id)
        VALUES
          (${tipoId}, ${precio}, ${moneda}, ${fechaTexto}::date, ${temporada}, ${motivo || `Tarifa de temporada ${temporada.toLowerCase()}`}, ${empleadoId})
        RETURNING rate_id`;
      const lista = await tx.$queryRaw`${Prisma.raw(PRECIO_SQL)} WHERE rr.rate_id = ${filas[0].rate_id}`;
      return presentarTarifa(lista[0]);
    });
  } catch (error) {
    if (error?.code === '23P01' || String(error?.message ?? '').toLowerCase().includes('ex_rate_no_overlap')) {
      throw conflicto('La vigencia de esta tarifa se superpone con otra tarifa existente.');
    }
    throw error;
  }
};

module.exports = { listar, obtener, crear };
