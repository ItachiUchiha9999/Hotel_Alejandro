const prisma = require('../../db/prisma');
const { noEncontrado, invalido } = require('../../utils/AppError');
const { toId, toText, toBool } = require('../../utils/parse');

const listar = async ({ soloActivos = false } = {}) =>
  prisma.deposit.findMany({
    where: soloActivos ? { deposit_state: true } : undefined,
    orderBy: { deposit_name: 'asc' },
  });

const obtener = async (id) => {
  const depositId = toId(id);
  if (!depositId) throw invalido('El identificador del depósito no es válido.');

  const deposito = await prisma.deposit.findUnique({ where: { deposit_id: depositId } });
  if (!deposito) throw noEncontrado('El depósito no existe.');
  return deposito;
};

const crear = async (datos) => {
  const nombre = toText(datos.deposit_name ?? datos.nombre);
  if (!nombre) throw invalido('El nombre del depósito es obligatorio.');

  return prisma.deposit.create({
    data: {
      deposit_name: nombre,
      deposit_location: toText(datos.deposit_location ?? datos.ubicacion),
      deposit_state: toBool(datos.deposit_state ?? datos.estado, true),
    },
  });
};

const actualizar = async (id, datos) => {
  const deposito = await obtener(id);

  const nombre = toText(datos.deposit_name ?? datos.nombre);
  const ubicacion = datos.deposit_location ?? datos.ubicacion;
  const estado = toBool(datos.deposit_state ?? datos.estado, null);

  return prisma.deposit.update({
    where: { deposit_id: deposito.deposit_id },
    data: {
      ...(nombre ? { deposit_name: nombre } : {}),
      ...(ubicacion !== undefined ? { deposit_location: toText(ubicacion) } : {}),
      ...(estado !== null ? { deposit_state: estado } : {}),
    },
  });
};

/** Baja lógica: los depósitos nunca se borran, se desactivan. */
const cambiarEstado = async (id, estado) => {
  const deposito = await obtener(id);
  const nuevoEstado = toBool(estado, !deposito.deposit_state);

  return prisma.deposit.update({
    where: { deposit_id: deposito.deposit_id },
    data: { deposit_state: nuevoEstado },
  });
};

module.exports = { listar, obtener, crear, actualizar, cambiarEstado };
