const prisma = require('../../db/prisma');
const { noEncontrado, conflicto, invalido } = require('../../utils/AppError');
const { toBool, toId, toText } = require('../../utils/parse');

const validarSigno = (valor) => {
  const signo = Number(valor);
  if (![1, -1].includes(signo)) throw invalido('El signo tiene que ser 1 o -1.');
  return signo;
};

const listar = ({ soloActivos = false } = {}) =>
  prisma.voucher_type.findMany({
    where: soloActivos ? { active: true } : undefined,
    orderBy: { voucher_type_id: 'asc' },
  });

const obtener = async (id) => {
  const typeId = toId(id);
  if (!typeId) throw invalido('El identificador del tipo no es válido.');

  const tipo = await prisma.voucher_type.findUnique({ where: { voucher_type_id: typeId } });
  if (!tipo) throw noEncontrado('El tipo de comprobante no existe.');
  return tipo;
};

const crear = async (datos = {}) => {
  const nombre = toText(datos.voucher_type ?? datos.nombre);
  const descripcion = toText(datos.description ?? datos.descripcion);
  if (!nombre) throw invalido('El nombre del tipo es obligatorio.');
  if (!descripcion) throw invalido('La descripción es obligatoria.');

  return prisma.voucher_type.create({
    data: {
      voucher_type: nombre.toUpperCase().replace(/\s+/g, '_'),
      description: descripcion,
      sign: validarSigno(datos.sign ?? datos.signo),
      affects_account: toBool(datos.affects_account, true),
      is_payable: toBool(datos.is_payable, true),
      active: toBool(datos.active ?? datos.activo, true),
    },
  });
};

const actualizar = async (id, datos = {}) => {
  const tipo = await obtener(id);
  const descripcion = toText(datos.description ?? datos.descripcion);
  if (!descripcion) throw invalido('La descripción es obligatoria.');
  const signo = validarSigno(datos.sign ?? datos.signo ?? tipo.sign);

  if (signo !== tipo.sign) {
    const usados = await prisma.supplier_voucher.count({
      where: { voucher_type_id: tipo.voucher_type_id },
    });
    if (usados > 0) {
      throw conflicto(
        `No se puede cambiar el efecto de "${tipo.voucher_type}" porque ya tiene ` +
        `${usados} comprobante(s) registrados.`
      );
    }
  }

  return prisma.voucher_type.update({
    where: { voucher_type_id: tipo.voucher_type_id },
    data: {
      description: descripcion,
      sign,
      affects_account: toBool(datos.affects_account, tipo.affects_account),
      is_payable: toBool(datos.is_payable, tipo.is_payable),
    },
  });
};

const cambiarEstado = async (id, estado) => {
  const tipo = await obtener(id);
  return prisma.voucher_type.update({
    where: { voucher_type_id: tipo.voucher_type_id },
    data: { active: toBool(estado, !tipo.active) },
  });
};

module.exports = { listar, obtener, crear, actualizar, cambiarEstado };