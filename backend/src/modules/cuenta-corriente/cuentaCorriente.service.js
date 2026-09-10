const prisma = require('../../db/prisma');
const { noEncontrado, invalido } = require('../../utils/AppError');
const { toId, toText } = require('../../utils/parse');

/**
 * Cuenta corriente de proveedores (PROV-06).
 *
 * "Consultar el estado de la cuenta corriente de proveedores con el detalle
 * de la forma de pago (cheque, transferencia o efectivo)".
 *
 * No hace falta reconstruir nada: Supplier_Account_Movement YA es el libro
 * mayor de cada proveedor. Lo escriben:
 *   - PROV-01 (comprobantes.service.crear)     → debita si el tipo suma deuda
 *                                                  (factura, nota de débito),
 *                                                  acredita si la resta (nota
 *                                                  de crédito).
 *   - PROV-05 (ordenesPago.service.confirmar)   → acredita el total de la
 *                                                  orden de pago confirmada.
 *
 * Este módulo solo LEE esa tabla y le agrega, por movimiento, el detalle que
 * pide la historia: forma de pago, referencia, y estado del comprobante
 * asociado (si lo hay).
 *
 * Criterios de aceptación cubiertos:
 *   - Debe registrar saldo del proveedor y estado de la cuenta  → saldoActual
 *     + saldoAlDia, calculados sobre TODO el historial.
 *   - Debe indicar la forma de pago utilizada                   → formaPago
 *     en cada movimiento que viene de una orden de pago.
 *   - Debe registrar importe, fecha y referencia de la operación → cada
 *     movimiento trae fecha, debito/credito y referencia.
 *   - El saldo debe actualizarse en función de los pagos registrados → el
 *     saldo se recalcula siempre desde la tabla real, nunca queda guardado
 *     "viejo".
 */

const includeMovimiento = {
  supplier_voucher: {
    select: {
      voucher_id: true,
      voucher_status: true,
      due_date: true,
      voucher_type: { select: { voucher_type: true } },
    },
  },
  payment_order: {
    select: {
      payment_order_id: true,
      payment_reference: true,
      payment_method: {
        select: { payment_method_id: true, payment_method: true },
      },
    },
  },
};

/** Da forma a un registro de Supplier_Account_Movement para el frontend. */
const aDTO = (m) => {
  const vencido =
    !!m.supplier_voucher &&
    m.supplier_voucher.voucher_status === 'PENDIENTE' &&
    m.supplier_voucher.due_date &&
    new Date(m.supplier_voucher.due_date) < new Date();

  return {
    account_movement_id: m.account_movement_id,
    movement_date: m.movement_date,
    concept: m.concept,
    debit: m.debit,
    credit: m.credit,
    voucher: m.supplier_voucher
      ? {
          voucher_id: m.supplier_voucher.voucher_id,
          voucher_type: m.supplier_voucher.voucher_type.voucher_type,
          voucher_status: m.supplier_voucher.voucher_status,
          is_overdue: vencido,
        }
      : null,
    payment: m.payment_order
      ? {
          payment_order_id: m.payment_order.payment_order_id,
          payment_reference: m.payment_order.payment_reference,
          payment_method_id: m.payment_order.payment_method.payment_method_id,
          payment_method: m.payment_order.payment_method.payment_method,
        }
      : null,
  };
};

/**
 * Cuenta corriente completa de un proveedor.
 *
 * Filtros opcionales (solo deciden qué movimientos se DEVUELVEN; el saldo y
 * los totales siempre se calculan sobre el historial completo, para que
 * sigan siendo correctos aunque se filtre la vista):
 *   - paymentMethodId: solo pagos hechos con esa forma de pago.
 *   - desde / hasta:   rango sobre movement_date ('YYYY-MM-DD').
 */
const obtenerCuenta = async (supplierId, filtros = {}) => {
  const sid = toId(supplierId);
  if (!sid) throw invalido('El identificador del proveedor no es válido.');

  const proveedor = await prisma.suppliers.findUnique({
    where: { supplier_id: sid },
    select: { supplier_id: true, supplier_legal_name: true, supplier_trade_name: true, supplier_state: true },
  });
  if (!proveedor) throw noEncontrado('El proveedor no existe.');

  const movimientos = await prisma.supplier_account_movement.findMany({
    where: { supplier_id: sid },
    include: includeMovimiento,
    orderBy: [{ movement_date: 'asc' }, { account_movement_id: 'asc' }],
  });

  // Saldo corrido sobre TODO el historial, en orden cronológico.
  let saldo = 0;
  const todos = movimientos.map((m) => {
    saldo += Number(m.debit) - Number(m.credit);
    return { ...aDTO(m), balance: saldo };
  });

  const saldoActual = todos.length ? todos[todos.length - 1].balance : 0;

  const totalFacturado = todos.reduce(
    (acc, m) => acc + (m.voucher ? Number(m.debit) : 0),
    0,
  );
  const totalPagado = todos.reduce((acc, m) => acc + (m.payment ? Number(m.credit) : 0), 0);

  const comprobantesPendientes = await prisma.supplier_voucher.count({
    where: { supplier_id: sid, voucher_status: 'PENDIENTE' },
  });

  // Filtros: se aplican DESPUÉS de calcular el saldo, así cada fila conserva
  // el saldo real que tenía en ese momento, aunque se oculten otras filas.
  const paymentMethodId = toId(filtros.paymentMethodId);
  const desde = toText(filtros.desde);
  const hasta = toText(filtros.hasta);

  const visibles = todos
    .filter((m) => (paymentMethodId ? m.payment?.payment_method_id === paymentMethodId : true))
    .filter((m) => (desde ? m.movement_date.toISOString().slice(0, 10) >= desde : true))
    .filter((m) => (hasta ? m.movement_date.toISOString().slice(0, 10) <= hasta : true))
    .slice()
    .reverse(); // más reciente primero

  return {
    supplier: proveedor,
    saldo_actual: saldoActual,
    cuenta_al_dia: saldoActual <= 0,
    total_facturado: totalFacturado,
    total_pagado: totalPagado,
    comprobantes_pendientes: comprobantesPendientes,
    movimientos: visibles,
  };
};

module.exports = { obtenerCuenta };