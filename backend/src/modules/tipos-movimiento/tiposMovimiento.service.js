const prisma = require('../../db/prisma');
const { noEncontrado, conflicto, invalido } = require('../../utils/AppError');
const { toId, toText, toBool } = require('../../utils/parse');

/**
 * Tipos de movimiento (STK-04).
 *
 * El `effect` es lo que define qué hace un tipo con el stock, así que el
 * catálogo es administrable: el encargado puede dar de alta "DEVOLUCIÓN A
 * PROVEEDOR" con efecto RESTA y el motor de movimientos lo soporta sin que
 * haya que tocar código.
 */

/** Los tres valores admitidos por el CHECK ck_movement_type_effect de la base. */
const EFECTOS = ['SUMA', 'RESTA', 'TRANSFERENCIA'];

const listar = async ({ soloActivos = false } = {}) =>
  prisma.movement_type.findMany({
    where: soloActivos ? { active: true } : undefined,
    orderBy: { movement_type_id: 'asc' },
  });

const obtener = async (id) => {
  const typeId = toId(id);
  if (!typeId) throw invalido('El identificador del tipo no es válido.');

  const tipo = await prisma.movement_type.findUnique({ where: { movement_type_id: typeId } });
  if (!tipo) throw noEncontrado('El tipo de movimiento no existe.');
  return tipo;
};

const validarEfecto = (valor) => {
  const efecto = toText(valor)?.toUpperCase();
  if (!efecto || !EFECTOS.includes(efecto)) {
    throw invalido(`El efecto tiene que ser uno de: ${EFECTOS.join(', ')}.`);
  }
  return efecto;
};

const crear = async (datos = {}) => {
  const nombre = toText(datos.movement_type ?? datos.movementType ?? datos.nombre);
  const descripcion = toText(datos.description ?? datos.descripcion);

  if (!nombre) throw invalido('El nombre del tipo es obligatorio.');
  if (!descripcion) throw invalido('La descripción es obligatoria.');

  // A diferencia de la versión de la rama, acá TRANSFERENCIA sí se admite al
  // crear: no tenía sentido permitirla al editar y rechazarla al dar de alta.
  const efecto = validarEfecto(datos.effect ?? datos.efecto);

  return prisma.movement_type.create({
    data: {
      movement_type: nombre.toUpperCase().replace(/\s+/g, '_'),
      description: descripcion,
      effect: efecto,
      active: toBool(datos.active ?? datos.activo, true),
    },
  });
};

const actualizar = async (id, datos = {}) => {
  const tipo = await obtener(id);

  const descripcion = toText(datos.description ?? datos.descripcion);
  if (!descripcion) throw invalido('La descripción es obligatoria.');

  const efecto = validarEfecto(datos.effect ?? datos.efecto);

  /**
   * El efecto no se puede cambiar si el tipo ya tiene movimientos: hacerlo
   * reinterpretaría el histórico (un egreso pasaría a leerse como ingreso) y
   * dejaría los saldos sin explicación posible en la auditoría.
   */
  if (efecto !== tipo.effect) {
    const usados = await prisma.stock_movement.count({
      where: { movement_type_id: tipo.movement_type_id },
    });

    if (usados > 0) {
      throw conflicto(
        `No se puede cambiar el efecto de "${tipo.movement_type}" porque ya tiene ` +
          `${usados} movimiento(s) registrados. Creá un tipo nuevo y desactivá este.`
      );
    }
  }

  return prisma.movement_type.update({
    where: { movement_type_id: tipo.movement_type_id },
    data: { description: descripcion, effect: efecto },
  });
};

/** Baja lógica: un tipo inactivo no aparece al registrar movimientos. */
const cambiarEstado = async (id, estado) => {
  const tipo = await obtener(id);
  const activo = toBool(estado, !tipo.active);

  return prisma.movement_type.update({
    where: { movement_type_id: tipo.movement_type_id },
    data: { active: activo },
  });
};

module.exports = { EFECTOS, listar, obtener, crear, actualizar, cambiarEstado };
