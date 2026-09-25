const prisma = require('../../db/prisma');

const {
  noEncontrado,
  conflicto,
  invalido,
} = require('../../utils/AppError');

const { toId, toText } = require('../../utils/parse');

/**
 * TAR-01 — Tarifas por tipo de habitación.
 *
 * Mapeo exacto de relaciones según schema.prisma:
 * room_type y employee (singular).
 */
const CON_RELACIONES = {
  room_type: {
    select: {
      room_type_id: true,
      room_type_name: true,
      room_type_max_capacity: true,
      room_type_state: true,
    },
  },
  employee: {
    select: {
      employees_id: true,
      employees_name: true,
      employees_lastname: true,
    },
  },
};

/** Formatea para el front asegurando compatibilidad */
const presentarTarifa = (tarifa) => {
  if (!tarifa) return null;
  const { employee, ...resto } = tarifa;
  return {
    ...resto,
    employee,
    employees: employee, // Soporte para frontends que esperen 'employees' o 'employee'
  };
};

/**
 * Convierte una fecha recibida como YYYY-MM-DD
 * a Date para Prisma.
 */
const parseFecha = (valor, nombreCampo = 'fecha') => {
  if (!valor) return null;

  const texto = String(valor).trim().slice(0, 10);
  const fecha = new Date(`${texto}T00:00:00.000Z`);

  if (Number.isNaN(fecha.getTime())) {
    throw invalido(`La ${nombreCampo} no es válida.`);
  }

  return fecha;
};

/**
 * Convierte y valida un precio.
 */
const parsePrecio = (valor) => {
  const precio = Number(valor);

  if (!Number.isFinite(precio) || precio <= 0) {
    throw invalido('El precio debe ser un número mayor que cero.');
  }

  return precio;
};

/**
 * LISTAR TARIFAS
 *
 * Filtros opcionales:
 * - tipo / roomTypeId
 * - soloVigentes / vigentes
 */
const listar = async ({
  tipo,
  soloVigentes = false,
} = {}) => {
  const where = {};
  const tipoId = toId(tipo);

  if (tipoId) {
    where.room_type_id = tipoId;
  }

  if (
    soloVigentes === true ||
    soloVigentes === 'true' ||
    soloVigentes === '1'
  ) {
    where.valid_to = null;
  }

  const tarifas = await prisma.room_type_rate.findMany({
    where,
    include: CON_RELACIONES,
    orderBy: [
      { valid_from: 'desc' },
      { rate_id: 'desc' },
    ],
  });

  return tarifas.map(presentarTarifa);
};

/**
 * OBTENER UNA TARIFA
 */
const obtener = async (id) => {
  const rateId = toId(id);

  if (!rateId) {
    throw invalido('El identificador de la tarifa no es válido.');
  }

  const tarifa = await prisma.room_type_rate.findUnique({
    where: { rate_id: rateId },
    include: CON_RELACIONES,
  });

  if (!tarifa) {
    throw noEncontrado('La tarifa no existe.');
  }

  return presentarTarifa(tarifa);
};

/**
 * CREAR UNA TARIFA
 */
const crear = async (datos = {}, actorEmployeeId = 1) => {
  const tipoId = toId(
    datos.room_type_id ?? datos.roomTypeId ?? datos.tipo
  );

  if (!tipoId) {
    throw invalido('Elegí un tipo de habitación.');
  }

  const precio = parsePrecio(
    datos.base_price ?? datos.precioBase ?? datos.precio
  );

  const moneda =
    toText(datos.currency ?? datos.moneda ?? 'ARS')?.toUpperCase();

  if (!moneda || moneda.length !== 3) {
    throw invalido('La moneda debe tener exactamente 3 caracteres, por ejemplo ARS.');
  }

  const hoyStr = new Date().toISOString().slice(0, 10);
  const fechaDesde =
    parseFecha(
      datos.valid_from ?? datos.fecha_desde ?? datos.fechaInicio ?? hoyStr,
      'fecha de vigencia'
    );

  const motivo = toText(datos.reason ?? datos.motivo);

  const empleadoId =
    toId(datos.employees_id ?? datos.employeeId) ||
    toId(actorEmployeeId) ||
    1;

  // Validaciones
  const tipo = await prisma.room_type.findUnique({
    where: { room_type_id: tipoId },
  });

  if (!tipo) {
    throw invalido('El tipo de habitación elegido no existe.');
  }

  if (!tipo.room_type_state) {
    throw conflicto(
      `El tipo "${tipo.room_type_name}" está inactivo y no puede recibir una nueva tarifa.`
    );
  }

  const empleado = await prisma.employees.findUnique({
    where: { employees_id: empleadoId },
  });

  if (!empleado) {
    throw invalido('El empleado responsable no existe.');
  }

  if (!empleado.employees_state) {
    throw conflicto('El empleado responsable está inactivo.');
  }

  return prisma.$transaction(async (tx) => {
    // Cerramos la tarifa vigente previa para evitar error de superposición
    await tx.room_type_rate.updateMany({
      where: {
        room_type_id: tipoId,
        valid_to: null,
      },
      data: {
        valid_to: fechaDesde,
      },
    });

    try {
      const nueva = await tx.room_type_rate.create({
        data: {
          room_type_id: tipoId,
          base_price: precio,
          currency: moneda,
          valid_from: fechaDesde,
          reason: motivo || 'Actualización de tarifa',
          employees_id: empleadoId,
        },
        include: CON_RELACIONES,
      });

      return presentarTarifa(nueva);
    } catch (error) {
      if (
        String(error?.message || '')
          .toLowerCase()
          .includes('ex_rate_no_overlap')
      ) {
        throw conflicto(
          'La vigencia de esta tarifa se superpone con otra tarifa existente.'
        );
      }
      throw error;
    }
  });
};

module.exports = {
  listar,
  obtener,
  crear,
};