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
 * Las tarifas NO se editan pisando el precio anterior.
 * Cada cambio crea una tarifa nueva y la base cierra automáticamente
 * la vigencia de la tarifa anterior.
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

  employees: {
    select: {
      employees_id: true,
      employees_name: true,
      employees_lastname: true,
    },
  },
};

/**
 * Convierte una fecha recibida como YYYY-MM-DD
 * a Date para Prisma.
 */
const parseFecha = (valor, nombreCampo = 'fecha') => {
  if (!valor) {
    return null;
  }

  const texto = String(valor).trim();

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
    throw invalido(
      'El precio debe ser un número mayor que cero.'
    );
  }

  return precio;
};

/**
 * LISTAR TARIFAS
 *
 * Filtros opcionales:
 * - tipo
 * - soloVigentes
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

  return prisma.room_type_rate.findMany({
    where,

    include: CON_RELACIONES,

    orderBy: [
      {
        valid_from: 'desc',
      },
      {
        rate_id: 'desc',
      },
    ],
  });
};

/**
 * OBTENER UNA TARIFA
 */
const obtener = async (id) => {
  const rateId = toId(id);

  if (!rateId) {
    throw invalido(
      'El identificador de la tarifa no es válido.'
    );
  }

  const tarifa =
    await prisma.room_type_rate.findUnique({
      where: {
        rate_id: rateId,
      },

      include: CON_RELACIONES,
    });

  if (!tarifa) {
    throw noEncontrado(
      'La tarifa no existe.'
    );
  }

  return tarifa;
};

/**
 * CREAR UNA TARIFA
 *
 * Al guardar una tarifa nueva, el trigger de PostgreSQL
 * cierra automáticamente la tarifa vigente anterior.
 */
const crear = async (datos = {}) => {
  const tipoId = toId(
    datos.room_type_id ?? datos.tipo
  );

  if (!tipoId) {
    throw invalido(
      'Elegí un tipo de habitación.'
    );
  }

  const precio = parsePrecio(
    datos.base_price ?? datos.precio
  );

  const moneda =
    toText(datos.currency ?? datos.moneda ?? 'ARS')
      ?.toUpperCase();

  if (!moneda || moneda.length !== 3) {
    throw invalido(
      'La moneda debe tener exactamente 3 caracteres, por ejemplo ARS.'
    );
  }

  const fechaDesde =
    parseFecha(
      datos.valid_from ??
        datos.fecha_desde ??
        new Date().toISOString().slice(0, 10),
      'fecha de vigencia'
    );

  const motivo =
    toText(datos.reason ?? datos.motivo);

  const empleadoId =
    toId(datos.employees_id) ||
    Number(process.env.DEFAULT_EMPLOYEE_ID || 1);

  /**
   * Validar tipo de habitación.
   */
  const tipo =
    await prisma.room_type.findUnique({
      where: {
        room_type_id: tipoId,
      },
    });

  if (!tipo) {
    throw invalido(
      'El tipo de habitación elegido no existe.'
    );
  }

  if (!tipo.room_type_state) {
    throw conflicto(
      `El tipo "${tipo.room_type_name}" está inactivo y no puede recibir una nueva tarifa.`
    );
  }

  /**
   * Validar empleado.
   */
  const empleado =
    await prisma.employees.findUnique({
      where: {
        employees_id: empleadoId,
      },
    });

  if (!empleado) {
    throw invalido(
      'El empleado responsable no existe.'
    );
  }

  if (!empleado.employees_state) {
    throw conflicto(
      'El empleado responsable está inactivo.'
    );
  }

  /**
   * Evitar que se intente crear una tarifa dentro
   * de un período que ya tiene precio.
   *
   * PostgreSQL también lo protege con EXCLUDE,
   * pero así mostramos un mensaje entendible.
   */
  const tarifaSuperpuesta =
    await prisma.room_type_rate.findFirst({
      where: {
        room_type_id: tipoId,

        valid_from: {
          lte: fechaDesde,
        },

        OR: [
          {
            valid_to: null,
          },
          {
            valid_to: {
              gt: fechaDesde,
            },
          },
        ],
      },
    });

  if (tarifaSuperpuesta) {
    /**
     * Si es la tarifa actualmente abierta, permitimos una nueva
     * siempre que empiece DESPUÉS de la fecha desde de la actual.
     *
     * El trigger cerrará la anterior automáticamente.
     */
    if (
      tarifaSuperpuesta.valid_to === null &&
      fechaDesde > tarifaSuperpuesta.valid_from
    ) {
      // permitido
    } else {
      throw conflicto(
        'Ya existe una tarifa para ese tipo de habitación en la fecha seleccionada.'
      );
    }
  }

  try {
    return await prisma.room_type_rate.create({
      data: {
        room_type_id: tipoId,
        base_price: precio,
        currency: moneda,
        valid_from: fechaDesde,
        reason: motivo || null,
        employees_id: empleadoId,
      },

      include: CON_RELACIONES,
    });
  } catch (error) {
    /**
     * PostgreSQL puede rechazar un período superpuesto
     * mediante la restricción EXCLUDE.
     */
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
};

module.exports = {
  listar,
  obtener,
  crear,
};