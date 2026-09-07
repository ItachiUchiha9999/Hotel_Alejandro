const prisma = require('../../db/prisma');
const { noEncontrado, invalido, conflicto } = require('../../utils/AppError');
const { toId, toText, toBool } = require('../../utils/parse');
const { normalizarCuit } = require('../../utils/cuit');

const aDTO = (s) => ({
  supplier_id: s.supplier_id,
  supplier_legal_name: s.supplier_legal_name,
  supplier_trade_name: s.supplier_trade_name,
  supplier_cuit: s.supplier_cuit,
  supplier_email: s.supplier_email,
  supplier_phone: s.supplier_phone,
  supplier_address: s.supplier_address,
  supplier_state: s.supplier_state,
  tax_condition_id: s.tax_condition_id,
  tax_condition_name: s.tax_condition?.tax_condition_name ?? null,
  creation_date: s.creation_date,
});

const listar = async ({ soloActivos = false } = {}) => {
  const proveedores = await prisma.suppliers.findMany({
    where: soloActivos ? { supplier_state: true } : undefined,
    include: { tax_condition: { select: { tax_condition_name: true } } },
    orderBy: { supplier_legal_name: 'asc' },
  });
  return proveedores.map(aDTO);
};

const obtener = async (id) => {
  const supplierId = toId(id);
  if (!supplierId) throw invalido('El identificador del proveedor no es válido.');

  const proveedor = await prisma.suppliers.findUnique({
    where: { supplier_id: supplierId },
    include: { tax_condition: { select: { tax_condition_name: true } } },
  });
  if (!proveedor) throw noEncontrado('El proveedor no existe.');
  return aDTO(proveedor);
};

const leerDatos = (datos = {}) => ({
  razonSocial: toText(datos.razonSocial ?? datos.supplier_legal_name),
  nombreFantasia: toText(datos.nombreFantasia ?? datos.supplier_trade_name),
  cuit: toText(datos.cuit ?? datos.supplier_cuit),
  email: toText(datos.email ?? datos.supplier_email),
  telefono: toText(datos.telefono ?? datos.supplier_phone),
  domicilio: toText(datos.domicilio ?? datos.supplier_address),
  condicionFiscalId: toId(datos.condicionFiscalId ?? datos.tax_condition_id),
});

const crear = async (body) => {
  const d = leerDatos(body);

  if (!d.razonSocial) throw invalido('La razón social es obligatoria.');
  if (!d.cuit) throw invalido('El CUIT es obligatorio.');

  const cuitNormalizado = normalizarCuit(d.cuit);
  if (!cuitNormalizado) {
    throw invalido('El CUIT no es válido. Verificá los 11 dígitos y el dígito verificador.');
  }

  if (d.condicionFiscalId) {
    const condicion = await prisma.tax_condition.findUnique({
      where: { tax_condition_id: d.condicionFiscalId },
    });
    if (!condicion) throw noEncontrado('La condición fiscal seleccionada no existe.');
  }

  try {
    const creado = await prisma.suppliers.create({
      data: {
        supplier_legal_name: d.razonSocial,
        supplier_trade_name: d.nombreFantasia,
        supplier_cuit: cuitNormalizado,
        supplier_email: d.email,
        supplier_phone: d.telefono,
        supplier_address: d.domicilio,
        tax_condition_id: d.condicionFiscalId,
      },
      include: { tax_condition: { select: { tax_condition_name: true } } },
    });
    return aDTO(creado);
  } catch (err) {
    if (err.code === 'P2002') throw conflicto('Ya existe un proveedor registrado con ese CUIT.');
    throw err;
  }
};

const actualizar = async (id, body) => {
  const actual = await obtener(id);
  const d = leerDatos(body);

  let cuitNormalizado;
  if (d.cuit) {
    cuitNormalizado = normalizarCuit(d.cuit);
    if (!cuitNormalizado) {
      throw invalido('El CUIT no es válido. Verificá los 11 dígitos y el dígito verificador.');
    }
  }

  if (d.condicionFiscalId) {
    const condicion = await prisma.tax_condition.findUnique({
      where: { tax_condition_id: d.condicionFiscalId },
    });
    if (!condicion) throw noEncontrado('La condición fiscal seleccionada no existe.');
  }

  try {
    const actualizado = await prisma.suppliers.update({
      where: { supplier_id: actual.supplier_id },
      data: {
        ...(d.razonSocial ? { supplier_legal_name: d.razonSocial } : {}),
        ...(body.nombreFantasia !== undefined || body.supplier_trade_name !== undefined
          ? { supplier_trade_name: d.nombreFantasia }
          : {}),
        ...(cuitNormalizado ? { supplier_cuit: cuitNormalizado } : {}),
        ...(body.email !== undefined || body.supplier_email !== undefined
          ? { supplier_email: d.email }
          : {}),
        ...(body.telefono !== undefined || body.supplier_phone !== undefined
          ? { supplier_phone: d.telefono }
          : {}),
        ...(body.domicilio !== undefined || body.supplier_address !== undefined
          ? { supplier_address: d.domicilio }
          : {}),
        ...(body.condicionFiscalId !== undefined || body.tax_condition_id !== undefined
          ? { tax_condition_id: d.condicionFiscalId }
          : {}),
      },
      include: { tax_condition: { select: { tax_condition_name: true } } },
    });
    return aDTO(actualizado);
  } catch (err) {
    if (err.code === 'P2002') throw conflicto('Ya existe un proveedor registrado con ese CUIT.');
    throw err;
  }
};

const cambiarEstado = async (id, estado) => {
  const actual = await obtener(id);
  const nuevoEstado = toBool(estado, !actual.supplier_state);

  const actualizado = await prisma.suppliers.update({
    where: { supplier_id: actual.supplier_id },
    data: { supplier_state: nuevoEstado },
    include: { tax_condition: { select: { tax_condition_name: true } } },
  });
  return aDTO(actualizado);
};

module.exports = { listar, obtener, crear, actualizar, cambiarEstado };