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
 *      comprobante, y registra el movimiento en la cuenta corriente.
 */

const ESTADO = { BORRADOR: 0, CONFIRMADA: 1, ANULADA: 2 };

const includeCompleto = {
  suppliers: {
    select: { supplier_id: true, supplier_legal_name: true, supplier_trade_name: true, supplier_cuit: true },
  },
  payment_method: true,
  employees: { select: { employees_name: true, employees_lastname: true } },
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
          voucher_type: { select: { voucher_type: true, sign: true } },
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

const obtener = async (id) => {
  const paymentOrderId = toId(id);
  if (!paymentOrderId) throw invalido('El identificador de la orden de pago no es válido.');

  const orden = await prisma.payment_order.findUnique({
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
  const employeeId = toId(body.employees_id ?? body.employeeId) || env.DEFAULT_EMPLOYEE_ID;

  if (!supplierId) throw invalido('Elegí un proveedor.');
  if (!paymentMethodId) throw invalido('Elegí un método de pago.');
  if (!paymentDate) throw invalido('Ingresá la fecha de pago.');

  const proveedor = await prisma.suppliers.findUnique({ where: { supplier_id: supplierId } });
  if (!proveedor) throw noEncontrado('El proveedor no existe.');
  if (!proveedor.supplier_state) throw conflicto('El proveedor está inactivo.');

  const metodo = await prisma.payment_method.findUnique({ where: { payment_method_id: paymentMethodId } });
  if (!metodo) throw noEncontrado('El método de pago no existe.');

  const empleado = await prisma.employees.findUnique({ where: { employees_id: employeeId } });
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

const agregarDetalle = async (ordenId, body) => {
  const paymentOrderId = toId(ordenId);
  const voucherId = toId(body.voucherId ?? body.voucher_id);
  const appliedAmount = Number(body.importe ?? body.applied_amount);

  if (!paymentOrderId) throw invalido('Identificador de orden no válido.');
  if (!voucherId) throw invalido('Elegí un comprobante.');
  if (!Number.isFinite(appliedAmount) || appliedAmount <= 0) {
    throw invalido('El importe a aplicar tiene que ser mayor a cero.');
  }

  const orden = await obtener(paymentOrderId);
  if (orden.payment_order_status !== ESTADO.BORRADOR) {
    throw conflicto('Solo se pueden agregar comprobantes a una orden en borrador.');
  }

  // Los triggers de la base validan: mismo proveedor, no anulado, es pagable,
  // importe no supera saldo pendiente. Si alguno falla, Prisma tira un error
  // genérico con el mensaje del RAISE EXCEPTION del trigger.
  try {
    await prisma.payment_order_detail.create({
      data: {
        payment_order_id: paymentOrderId,
        voucher_id: voucherId,
        applied_amount: appliedAmount,
      },
    });
  } catch (err) {
    if (err.code === 'P2002') {
      throw conflicto('Ese comprobante ya está incluido en esta orden.');
    }
    // Los triggers de Postgres tiran mensajes útiles en err.message
    if (err.message?.includes('RAISE')) {
      const msg = err.message.split('\n').find((l) => !l.startsWith('Code:')) ?? err.message;
      throw invalido(msg);
    }
    throw err;
  }

  return obtener(paymentOrderId);
};

const quitarDetalle = async (ordenId, detalleId) => {
  const paymentOrderId = toId(ordenId);
  const detailId = toId(detalleId);

  const orden = await obtener(paymentOrderId);
  if (orden.payment_order_status !== ESTADO.BORRADOR) {
    throw conflicto('Solo se pueden quitar comprobantes de una orden en borrador.');
  }

  const detalle = await prisma.payment_order_detail.findUnique({ where: { detail_id: detailId } });
  if (!detalle || detalle.payment_order_id !== paymentOrderId) {
    throw noEncontrado('El renglón no existe en esta orden.');
  }

  await prisma.payment_order_detail.delete({ where: { detail_id: detailId } });
  return obtener(paymentOrderId);
};

// ---------------------------------------------------------------------------
// Confirmar: pasar de BORRADOR a CONFIRMADA
// ---------------------------------------------------------------------------

const confirmar = async (ordenId) => {
  const paymentOrderId = toId(ordenId);
  const orden = await obtener(paymentOrderId);

  if (orden.payment_order_status !== ESTADO.BORRADOR) {
    throw conflicto('Solo se puede confirmar una orden en borrador.');
  }
  if (orden.payment_order_detail.length === 0) {
    throw invalido('La orden no tiene comprobantes. Agregá al menos uno antes de confirmar.');
  }

  return prisma.$transaction(async (tx) => {
    // 1. Actualizar paid_amount de cada comprobante
    for (const det of orden.payment_order_detail) {
      await tx.supplier_voucher.update({
        where: { voucher_id: det.voucher_id },
        data: { paid_amount: { increment: det.applied_amount } },
      });
    }

    // 2. Registrar el movimiento en la cuenta corriente (crédito = baja la deuda)
    await tx.supplier_account_movement.create({
      data: {
        supplier_id: orden.supplier_id,
        concept: `Orden de pago #${paymentOrderId} — ${orden.payment_method.payment_method}`,
        credit: orden.total_amount,
        debit: 0,
        payment_order_id: paymentOrderId,
        employees_id: orden.employees_id,
      },
    });

    // 3. Marcar la orden como confirmada
    await tx.payment_order.update({
      where: { payment_order_id: paymentOrderId },
      data: {
        payment_order_status: ESTADO.CONFIRMADA,
        confirmed_date: new Date(),
      },
    });

    return obtener(paymentOrderId);
  });
};

module.exports = {
  listar,
  obtener,
  comprobantesPendientes,
  crear,
  agregarDetalle,
  quitarDetalle,
  confirmar,
};