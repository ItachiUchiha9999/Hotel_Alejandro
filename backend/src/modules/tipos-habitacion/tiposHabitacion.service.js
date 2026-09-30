const prisma = require('../../db/prisma');
const { noEncontrado, conflicto, invalido } = require('../../utils/AppError');
const { toId, toText, toPositive, toBool } = require('../../utils/parse');

const NOMBRE_MAX = 60;
const DESCRIPCION_MAX = 255;
const CAPACIDAD_MAX = 20;

/**
 * Consulta relacional para HAB-04:
 * Cuenta solo habitaciones asociadas activas y trae la tarifa vigente (valid_to: null).
 */
const CON_CONTEO = {
  _count: {
    select: {
      rooms: {
        where: { active: true },
      },
    },
  },
  rates: {
    where: { valid_to: null },
    orderBy: { valid_from: 'desc' },
    take: 1,
    select: { rate_id: true, base_price: true, currency: true, valid_from: true, reason: true },
  },
};

const presentar = ({ _count, rates, ...tipo }) => ({
  ...tipo,
  rooms_count: _count?.rooms ?? 0,
  current_price: rates?.[0]?.base_price ?? null,
  current_currency: rates?.[0]?.currency ?? 'ARS',
  current_rate_id: rates?.[0]?.rate_id ?? null,
});

const leerDatos = (datos = {}) => {
  const nombre = toText(datos.room_type_name ?? datos.nombre)?.replace(/\s+/g, ' ');
  const descripcion = toText(datos.room_type_description ?? datos.descripcion);
  const capacidad = toPositive(datos.room_type_max_capacity ?? datos.capacidad);

  if (!nombre) throw invalido('El nombre del tipo de habitación es obligatorio.');
  if (nombre.length < 2) throw invalido('El nombre tiene que tener al menos 2 caracteres.');
  if (nombre.length > NOMBRE_MAX) {
    throw invalido(`El nombre no puede superar los ${NOMBRE_MAX} caracteres.`);
  }
  if (descripcion && descripcion.length > DESCRIPCION_MAX) {
    throw invalido(`La descripción no puede superar los ${DESCRIPCION_MAX} caracteres.`);
  }
  if (!capacidad || capacidad > CAPACIDAD_MAX) {
    throw invalido(`La capacidad máxima tiene que ser un número entero entre 1 y ${CAPACIDAD_MAX}.`);
  }

  return { nombre, descripcion, capacidad };
};

const leerPrecio = (datos = {}) => {
  const valor = datos.base_price ?? datos.precioBase ?? datos.basePrice;
  if (valor === undefined || valor === null || valor === '') return null;
  const precio = Number(valor);
  if (!Number.isFinite(precio) || precio <= 0) {
    throw invalido('El precio por noche debe ser mayor que cero.');
  }
  return precio;
};

// TAR-01: Cierra la tarifa vigente previa y crea una nueva para mantener el historial
const guardarTarifa = async (tx, roomTypeId, precio, reason = 'Actualización de tarifa base', employeeId = 1) => {
  if (precio === null) return;

  const hoy = new Date();

  // Cerrar tarifa vigente previa
  await tx.room_type_rate.updateMany({
    where: { room_type_id: roomTypeId, valid_to: null },
    data: { valid_to: hoy },
  });

  // Insertar nueva tarifa en el historial
  return tx.room_type_rate.create({
    data: {
      room_type_id: roomTypeId,
      base_price: precio,
      currency: 'ARS',
      valid_from: hoy,
      reason: reason || 'Tarifa actualizada',
      employees_id: Number(employeeId) || 1,
    },
  });
};

const verificarNombreLibre = async (nombre, ignorarId = null) => {
  const existente = await prisma.room_type.findFirst({
    where: {
      room_type_name: { equals: nombre, mode: 'insensitive' },
      ...(ignorarId ? { NOT: { room_type_id: ignorarId } } : {}),
    },
    select: { room_type_id: true },
  });

  if (existente) {
    throw conflicto('Ya existe un tipo de habitación con ese nombre. Elegí otro.');
  }
};

// HAB-04: Lista con filtro de estado
const listar = async ({ estado, soloActivos = false } = {}) => {
  let where = undefined;
  if (estado === 'ACTIVO' || estado === 'true' || soloActivos) {
    where = { room_type_state: true };
  } else if (estado === 'INACTIVO' || estado === 'false') {
    where = { room_type_state: false };
  }

  const tipos = await prisma.room_type.findMany({
    where,
    include: CON_CONTEO,
    orderBy: { room_type_id: 'asc' },
  });
  return tipos.map(presentar);
};

const obtener = async (id) => {
  const tipoId = toId(id);
  if (!tipoId) throw invalido('El identificador del tipo de habitación no es válido.');

  const tipo = await prisma.room_type.findUnique({
    where: { room_type_id: tipoId },
    include: CON_CONTEO,
  });
  if (!tipo) throw noEncontrado('El tipo de habitación no existe.');
  return presentar(tipo);
};

const crear = async (datos = {}, employeeId = 1) => {
  const { nombre, descripcion, capacidad } = leerDatos(datos);
  const precio = leerPrecio(datos);
  await verificarNombreLibre(nombre);

  return prisma.$transaction(async (tx) => {
    const tipo = await tx.room_type.create({
      data: {
        room_type_name: nombre,
        room_type_description: descripcion,
        room_type_max_capacity: capacidad,
        room_type_state: toBool(datos.room_type_state ?? datos.estado, true),
      },
    });

    if (precio !== null) {
      await guardarTarifa(tx, tipo.room_type_id, precio, 'Tarifa inicial', employeeId);
    }

    const completo = await tx.room_type.findUnique({
      where: { room_type_id: tipo.room_type_id },
      include: CON_CONTEO,
    });
    return presentar(completo);
  });
};

const actualizar = async (id, datos = {}, employeeId = 1) => {
  const actual = await obtener(id);
  const { nombre, descripcion, capacidad } = leerDatos(datos);
  const precio = leerPrecio(datos);
  await verificarNombreLibre(nombre, actual.room_type_id);

  return prisma.$transaction(async (tx) => {
    await tx.room_type.update({
      where: { room_type_id: actual.room_type_id },
      data: {
        room_type_name: nombre,
        room_type_description: descripcion,
        room_type_max_capacity: capacidad,
        room_type_state: toBool(datos.room_type_state ?? datos.estado, actual.room_type_state),
      },
    });

    if (precio !== null && precio !== Number(actual.current_price)) {
      await guardarTarifa(tx, actual.room_type_id, precio, datos.motivo || 'Actualización de tarifa', employeeId);
    }

    const completo = await tx.room_type.findUnique({
      where: { room_type_id: actual.room_type_id },
      include: CON_CONTEO,
    });
    return presentar(completo);
  });
};

// TAR-01: Endpoint específico para fijar o cambiar la tarifa
const asignarTarifa = async (id, { basePrice, reason, employeeId }) => {
  const actual = await obtener(id);
  const precio = leerPrecio({ basePrice });
  if (precio === null) throw invalido('El precio por noche es obligatorio.');

  return prisma.$transaction(async (tx) => {
    await guardarTarifa(tx, actual.room_type_id, precio, reason, employeeId);
    const completo = await tx.room_type.findUnique({
      where: { room_type_id: actual.room_type_id },
      include: CON_CONTEO,
    });
    return presentar(completo);
  });
};

// TAR-01: Ver historial de tarifas
const historialTarifas = async (id) => {
  const tipoId = toId(id);
  return prisma.room_type_rate.findMany({
    where: { room_type_id: tipoId },
    include: {
      employee: {
        select: {
          employees_name: true,
          employees_lastname: true,
        },
      },
    },
    orderBy: { valid_from: 'desc' },
  });
};

const cambiarEstado = async (id, estado) => {
  const actual = await obtener(id);
  const activo = toBool(estado, !actual.room_type_state);

  const tipo = await prisma.room_type.update({
    where: { room_type_id: actual.room_type_id },
    data: { room_type_state: activo },
    include: CON_CONTEO,
  });
  return presentar(tipo);
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  asignarTarifa,
  historialTarifas,
  cambiarEstado,
};