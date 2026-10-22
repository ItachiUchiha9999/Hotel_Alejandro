const prisma = require('../../db/prisma');
const env = require('../../config/env');
const { noEncontrado, invalido, conflicto } = require('../../utils/AppError');
const { toId, toText } = require('../../utils/parse');

/**
 * Órdenes de pago (PROV-05).
 *
 * Flujo:
 *   1. Crear la orden en BORRADOR (cabecera: proveedor + método + fecha).
 *   2. Agregar renglones: qué comprobantes se pagan y con qué importe.
 *      Los triggers de la base validan que el comprobante sea del mismo
 *      proveedor, que no esté anulado, que sea pagable, y que el importe
 *      no supere el saldo pendiente.
 *   3. Confirmar: pasa a estado 1, actualiza paid_amount de cada
 *      comprobante, fija fecha/hora exacta en confirmed_date y registra el
 *      movimiento en la cuenta corriente.
 */

const ESTADO = { BORRADOR: 0, CONFIRMADA: 1, ANULADA: 2 };

const includeCompleto = {
  suppliers: {
    select: {
      supplier_id: true,
      supplier_legal_name: true,
      supplier_trade_name: true,
      supplier_cuit: true,
    },
  },
  payment_method: true,
  employees: {
    select: {
      employees_name: true,
      employees_lastname: true,
    },
  },
  payment_order_detail: {
    include: {
      supplier_voucher: {
        select: {
          voucher_id: true,
          voucher_number: true,
          voucher_point_of_sale: true,
          issue_date: true,
          total_amount: true,
          paid_amount: true,
          voucher_status: true,
          voucher_type: {
            select: {
              voucher_type: true,
              sign: true,
            },
          },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

const listar = async ({ supplierId } = {}) => {
  const where = {};
  const sid = toId(supplierId);
  if (sid) where.supplier_id = sid;

  return prisma.payment_order.findMany({
    where,
    include: includeCompleto,
    orderBy: { creation_date: 'desc' },
  });
};

const obtener = async (id, cliente = prisma) => {
  const paymentOrderId = toId(id);
  if (!paymentOrderId) {
    throw invalido('El identificador de la orden de pago no es válido.');
  }

  const orden = await cliente.payment_order.findUnique({
    where: { payment_order_id: paymentOrderId },
    include: includeCompleto,
  });

  if (!orden) throw noEncontrado('La orden de pago no existe.');
  return orden;
};

/**
 * Comprobantes pendientes de un proveedor (para el selector del formulario).
 * Devuelve solo los que tienen saldo > 0, no están anulados, y su tipo
 * es pagable (is_payable = true).
 */
const comprobantesPendientes = async (supplierId) => {
  const sid = toId(supplierId);
  if (!sid) throw invalido('El identificador del proveedor no es válido.');

  return prisma.supplier_voucher.findMany({
    where: {
      supplier_id: sid,
      voucher_status: 'PENDIENTE',
      voucher_type: { is_payable: true },
    },
    include: {
      voucher_type: { select: { voucher_type: true, sign: true } },
    },
    orderBy: { issue_date: 'asc' },
  });
};

// ---------------------------------------------------------------------------
// Crear orden (BORRADOR)
// ---------------------------------------------------------------------------

const crear = async (body) => {
  const supplierId = toId(body.supplierId ?? body.supplier_id);
  const paymentMethodId = toId(body.metodoId ?? body.payment_method_id);
  const paymentDate = body.fecha ?? body.payment_date;
  const observations = toText(body.observaciones ?? body.observations);
  const paymentReference = toText(body.referencia ?? body.payment_reference);
  const employeeId =
    toId(body.employees_id ?? body.employeeId) || env.DEFAULT_EMPLOYEE_ID;

  if (!supplierId) throw invalido('Elegí un proveedor.');
  if (!paymentMethodId) throw invalido('Elegí un método de pago.');
  if (!paymentDate) throw invalido('Ingresá la fecha de pago.');

  const proveedor = await prisma.suppliers.findUnique({
    where: { supplier_id: supplierId },
  });
  if (!proveedor) throw noEncontrado('El proveedor no existe.');
  if (!proveedor.supplier_state) throw conflicto('El proveedor está inactivo.');

  const metodo = await prisma.payment_method.findUnique({
    where: { payment_method_id: paymentMethodId },
  });
  if (!metodo) throw noEncontrado('El método de pago no existe.');
  if (!metodo.active) throw conflicto('El método de pago está inactivo.');
  if (metodo.requires_reference && !paymentReference) throw invalido('Este método de pago requiere una referencia.');
  if (Number.isNaN(new Date(paymentDate).getTime())) throw invalido('La fecha de pago no es válida.');

  const empleado = await prisma.employees.findUnique({
    where: { employees_id: employeeId },
  });
  if (!empleado) throw invalido('No se pudo identificar al empleado.');

  const orden = await prisma.payment_order.create({
    data: {
      supplier_id: supplierId,
      payment_method_id: paymentMethodId,
      payment_date: new Date(paymentDate),
      payment_reference: paymentReference,
      observations,
      employees_id: employeeId,
      payment_order_status: ESTADO.BORRADOR,
    },
    include: includeCompleto,
  });

  return orden;
};

// ---------------------------------------------------------------------------
// Detalle: agregar / quitar comprobantes
// ---------------------------------------------------------------------------

// Se bloquea primero la orden y luego sus comprobantes en orden de ID.
// Así agregar/quitar detalles y confirmar nunca usan un borrador desactualizado.
const bloquearOrden = async (tx, id) => {
  const paymentOrderId = toId(id);
  if (!paymentOrderId) throw invalido('El identificador de la orden de pago no es válido.');
  await tx.$queryRaw`SELECT payment_order_id FROM payment_order WHERE payment_order_id = ${paymentOrderId} FOR UPDATE`;
  return obtener(paymentOrderId, tx);
};

const validarComprobantePagable = async (tx, voucherId, supplierId, importe) => {
  await tx.$queryRaw`SELECT voucher_id FROM supplier_voucher WHERE voucher_id = ${voucherId} FOR UPDATE`;
  const comprobante = await tx.supplier_voucher.findUnique({
    where: { voucher_id: voucherId }, include: { voucher_type: true },
  });
  if (!comprobante) throw noEncontrado('El comprobante no existe.');
  if (comprobante.supplier_id !== supplierId) throw conflicto('El comprobante no corresponde al proveedor de la orden de pago.');
  if (comprobante.voucher_status === 'ANULADO') throw conflicto('No se puede pagar un comprobante anulado.');
  if (!comprobante.voucher_type.is_payable) throw conflicto('El tipo de comprobante no admite pagos.');
  const saldo = Number(comprobante.total_amount) - Number(comprobante.paid_amount);
  if (importe > saldo + 0.001) throw conflicto(`El importe supera el saldo pendiente del comprobante: $${Math.max(0, saldo).toFixed(2)}.`);
};

const agregarDetalle = async (ordenId, body) => {
  const voucherId = toId(body.voucherId ?? body.voucher_id);
  const appliedAmount = Number(body.importe ?? body.applied_amount);
  if (!voucherId) throw invalido('Elegí un comprobante.');
  if (!Number.isFinite(appliedAmount) || appliedAmount <= 0 || Math.abs(appliedAmount * 100 - Math.round(appliedAmount * 100)) > 0.000001) {
    throw invalido('El importe a aplicar tiene que ser mayor a cero y tener como máximo dos decimales.');
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const orden = await bloquearOrden(tx, ordenId);
      if (orden.payment_order_status !== ESTADO.BORRADOR) throw conflicto('Solo se pueden agregar comprobantes a una orden en borrador.');
      if (orden.payment_order_detail.some(det => det.voucher_id === voucherId)) throw conflicto('Ese comprobante ya está incluido en esta orden.');
      await validarComprobantePagable(tx, voucherId, orden.supplier_id, appliedAmount);
      await tx.payment_order_detail.create({ data: {
        payment_order_id: orden.payment_order_id, voucher_id: voucherId, applied_amount: appliedAmount,
      } });
      return obtener(orden.payment_order_id, tx);
    });
  } catch (err) {
    if (err.code === 'P2002') throw conflicto('Ese comprobante ya está incluido en esta orden.');
    throw err;
  }
};

const quitarDetalle = async (ordenId, detalleId) => {
  const detailId = toId(detalleId);
  if (!detailId) throw invalido('El identificador del renglón no es válido.');
  return prisma.$transaction(async (tx) => {
    const orden = await bloquearOrden(tx, ordenId);
    if (orden.payment_order_status !== ESTADO.BORRADOR) throw conflicto('Solo se pueden quitar comprobantes de una orden en borrador.');
    const detalle = orden.payment_order_detail.find(det => det.detail_id === detailId);
    if (!detalle) throw noEncontrado('El renglón no existe en esta orden.');
    await tx.payment_order_detail.delete({ where: { detail_id: detailId } });
    return obtener(orden.payment_order_id, tx);
  });
};

const confirmar = async (ordenId) => prisma.$transaction(async (tx) => {
  const orden = await bloquearOrden(tx, ordenId);
  if (orden.payment_order_status !== ESTADO.BORRADOR) throw conflicto('Solo se puede confirmar una orden en borrador.');
  if (orden.payment_order_detail.length === 0) throw invalido('La orden no tiene comprobantes. Agregá al menos uno antes de confirmar.');
  if (!orden.payment_method.active) throw conflicto('El método de pago está inactivo.');
  if (orden.payment_method.requires_reference && !orden.payment_reference?.trim()) throw invalido('Este método de pago requiere una referencia.');

  // El saldo puede haber cambiado por otra OP desde que se armó el borrador.
  for (const det of [...orden.payment_order_detail].sort((a, b) => a.voucher_id - b.voucher_id)) {
    await validarComprobantePagable(tx, det.voucher_id, orden.supplier_id, Number(det.applied_amount));
  }
  const momentoActual = new Date();
  for (const det of orden.payment_order_detail) {
    await tx.supplier_voucher.update({ where: { voucher_id: det.voucher_id }, data: { paid_amount: { increment: det.applied_amount } } });
  }
  await tx.supplier_account_movement.create({ data: {
    supplier_id: orden.supplier_id,
    concept: `Orden de pago #${orden.payment_order_id} — ${orden.payment_method.payment_method}`,
    credit: orden.total_amount, debit: 0, payment_order_id: orden.payment_order_id,
    employees_id: orden.employees_id, movement_date: momentoActual,
  } });
  await tx.payment_order.update({ where: { payment_order_id: orden.payment_order_id }, data: {
    payment_order_status: ESTADO.CONFIRMADA, payment_date: momentoActual, confirmed_date: momentoActual,
  } });
  // Leer con el mismo cliente garantiza que la respuesta vea la confirmación.
  return obtener(orden.payment_order_id, tx);
});


module.exports = {
  listar,
  obtener,
  comprobantesPendientes,
  crear,
  agregarDetalle,
  quitarDetalle,
  confirmar,
};