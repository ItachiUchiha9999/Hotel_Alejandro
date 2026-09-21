const prisma = require('../../db/prisma');
const { Prisma } = require('@prisma/client');
const env = require('../../config/env');
const { noEncontrado, conflicto, invalido } = require('../../utils/AppError');
const { toId, toPositive, toText } = require('../../utils/parse');

/**
 * Comprobantes de proveedores — PROV-01 (registrar la recepción).
 *
 * Criterios de aceptación cubiertos:
 *   - Permite seleccionar proveedor y tipo de comprobante.
 *   - Vincula órdenes de compra APROBADAS del proveedor.
 *   - Registra número, fecha, importe total y estado.
 *   - Soporta facturación parcial: almacena el detalle exacto de ítems facturados
 *     (cantidades y precios editados) dentro de la cabecera.
 *   - No permite duplicar un comprobante para el mismo proveedor.
 *   - Queda como pendiente de pago al ingresar.
 */

/** Fecha en formato YYYY-MM-DD, o null si no es válida. */
const toDate = (valor) => {
  const texto = toText(valor);
  if (!texto) return null;
  const fecha = new Date(`${texto}T00:00:00`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

/** Estados válidos de comprobante (coincide con el CHECK de la base). */
const ESTADOS_VALIDOS = ['PENDIENTE', 'PAGADO', 'ANULADO'];

/** Estado de comprobante en mayúsculas si es válido, o null. */
const toEstado = (valor) => {
  const texto = toText(valor);
  if (!texto) return null;
  const estado = texto.toUpperCase();
  if (!ESTADOS_VALIDOS.includes(estado)) {
    throw invalido(`El estado "${valor}" no es válido. Usá PENDIENTE, PAGADO o ANULADO.`);
  }
  return estado;
};

// ---------------------------------------------------------------------------
// Helpers de serialización de observaciones e ítems
// ---------------------------------------------------------------------------

const PREFIJO_ITEMS = '__ITEMS_FACTURADOS__:';

const empaquetarObservaciones = (textoObservaciones, items) => {
  const base = toText(textoObservaciones) || '';
  if (!Array.isArray(items) || items.length === 0) {
    return base || null;
  }

  const itemsPayload = items.map((it) => ({
    detail_id: toId(it.detail_id ?? it.purchase_detail_id),
    article_id: toId(it.article_id) || null,
    item_description: String(it.item_description ?? it.descripcion ?? ''),
    quantity: Number(it.quantity ?? it.cantidadFacturada ?? 0),
    unit_price: Number(it.unit_price ?? it.precioUnitario ?? 0),
    subtotal:
      Number(it.quantity ?? it.cantidadFacturada ?? 0) *
      Number(it.unit_price ?? it.precioUnitario ?? 0),
  }));

  const json = JSON.stringify(itemsPayload);
  return base ? `${base}\n${PREFIJO_ITEMS}${json}` : `${PREFIJO_ITEMS}${json}`;
};

const desempaquetarObservaciones = (textoCrudo) => {
  if (!textoCrudo || !textoCrudo.includes(PREFIJO_ITEMS)) {
    return { observaciones: textoCrudo || null, itemsFacturados: null };
  }

  const partes = textoCrudo.split(PREFIJO_ITEMS);
  const observaciones = partes[0].trim() || null;
  let itemsFacturados = null;

  try {
    itemsFacturados = JSON.parse(partes[1].trim());
  } catch {
    itemsFacturados = null;
  }

  return { observaciones, itemsFacturados };
};

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

const listar = async (filtros = {}) => {
  const supplierId = toId(filtros.supplierId);
  const voucherTypeId = toId(filtros.voucherTypeId);
  const estado = toEstado(filtros.estado);
  const desde = toDate(filtros.desde);
  const hasta = toDate(filtros.hasta);

  if (desde && hasta && hasta < desde) {
    throw invalido('El rango de fechas no es válido: "hasta" no puede ser anterior a "desde".');
  }

  const condiciones = [];
  if (supplierId) condiciones.push(Prisma.sql`v.supplier_id = ${supplierId}`);
  if (estado) condiciones.push(Prisma.sql`v.voucher_status = ${estado}`);
  if (desde) condiciones.push(Prisma.sql`v.issue_date >= ${desde}`);
  if (hasta) condiciones.push(Prisma.sql`v.issue_date <= ${hasta}`);

  let origen = Prisma.sql`v_supplier_voucher_balance v`;
  if (voucherTypeId) {
    origen = Prisma.sql`v_supplier_voucher_balance v
      JOIN voucher_type vt ON vt.voucher_type = v.voucher_type`;
    condiciones.push(Prisma.sql`vt.voucher_type_id = ${voucherTypeId}`);
  }

  const where = condiciones.length
    ? Prisma.sql`WHERE ${Prisma.join(condiciones, ' AND ')}`
    : Prisma.empty;

  return prisma.$queryRaw`
    SELECT v.*
    FROM ${origen}
    ${where}
    ORDER BY v.issue_date DESC, v.voucher_id DESC`;
};

const obtener = async (id) => {
  const voucherId = toId(id);
  if (!voucherId) throw invalido('El identificador del comprobante no es válido.');

  const comprobante = await prisma.supplier_voucher.findUnique({
    where: { voucher_id: voucherId },
    include: {
      suppliers: {
        select: {
          supplier_id: true,
          supplier_legal_name: true,
          supplier_trade_name: true,
        },
      },
      voucher_type: true,
      employees: {
        select: {
          employees_name: true,
          employees_lastname: true,
        },
      },
      purchase_order: {
        include: {
          purchase_order_detail: true,
        },
      },
    },
  });

  if (!comprobante) throw noEncontrado('El comprobante no existe.');

  // Desempaquetar observaciones limpias e ítems facturados
  const { observaciones, itemsFacturados } = desempaquetarObservaciones(comprobante.observations);

  // Si se guardaron ítems específicos para esta factura, se usan esos;
  // de lo contrario, se mantiene el detalle completo de la OC como fallback.
  const purchaseOrderData = comprobante.purchase_order
    ? {
        ...comprobante.purchase_order,
        purchase_order_detail:
          itemsFacturados && itemsFacturados.length > 0
            ? itemsFacturados
            : comprobante.purchase_order.purchase_order_detail,
      }
    : null;

  return {
    ...comprobante,
    observations: observaciones,
    items_facturados: itemsFacturados,
    purchase_order: purchaseOrderData,
  };
};

/**
 * Consulta órdenes de compra en estado APROBADA de un proveedor.
 * Incluye el detalle de renglones para precargar y editar en el front.
 */
const ordenesCompraAprobadas = async (supplierId) => {
  const sid = toId(supplierId);
  if (!sid) throw invalido('El identificador del proveedor no es válido.');

  return prisma.purchase_order.findMany({
    where: {
      supplier_id: sid,
      purchase_order_status: 'APROBADA',
    },
    include: {
      purchase_order_detail: true,
    },
    orderBy: { issue_date: 'desc' },
  });
};

// ---------------------------------------------------------------------------
// Alta de comprobante
// ---------------------------------------------------------------------------

const crear = async (payload = {}) => {
  // ---- 1. Formato ----
  const supplierId = toId(payload.supplier_id ?? payload.proveedorId);
  if (!supplierId) throw invalido('Elegí el proveedor.');

  const typeId = toId(payload.voucher_type_id ?? payload.tipoId);
  if (!typeId) throw invalido('Elegí el tipo de comprobante.');

  const numero = toText(payload.voucher_number ?? payload.numero);
  if (!numero) throw invalido('Ingresá el número del comprobante.');

  const puntoVenta = toText(payload.voucher_point_of_sale ?? payload.puntoVenta) || '0001';

  const emision = toDate(payload.issue_date ?? payload.fechaEmision);
  if (!emision) throw invalido('Ingresá una fecha de emisión válida.');

  const vencimiento = toDate(payload.due_date ?? payload.fechaVencimiento);
  if (vencimiento && vencimiento < emision) {
    throw invalido('La fecha de vencimiento no puede ser anterior a la de emisión.');
  }

  const importe = toPositive(payload.total_amount ?? payload.importe);
  if (!importe) throw invalido('El importe total tiene que ser mayor a cero.');

  const employeeId = toId(payload.employees_id) || env.DEFAULT_EMPLOYEE_ID;
  const purchaseOrderId = toId(
    payload.purchase_order_id ?? payload.purchaseOrderId ?? payload.ordenCompraId
  );

  const items = payload.items ?? payload.itemsFactura ?? [];

  // ---- 2. Validación contra la base ----
  const proveedor = await prisma.suppliers.findUnique({ where: { supplier_id: supplierId } });
  if (!proveedor) throw noEncontrado('El proveedor no existe.');
  if (!proveedor.supplier_state) {
    throw conflicto(`El proveedor "${proveedor.supplier_legal_name}" está inactivo.`);
  }

  const tipo = await prisma.voucher_type.findUnique({ where: { voucher_type_id: typeId } });
  if (!tipo) throw noEncontrado('El tipo de comprobante no existe.');
  if (!tipo.active) throw conflicto(`El tipo "${tipo.voucher_type}" está inactivo.`);

  const empleado = await prisma.employees.findUnique({ where: { employees_id: employeeId } });
  if (!empleado) throw invalido('No se pudo identificar al empleado que registra el comprobante.');

  if (purchaseOrderId) {
    const ordenCompra = await prisma.purchase_order.findUnique({
      where: { purchase_order_id: purchaseOrderId },
    });

    if (!ordenCompra) {
      throw noEncontrado('La orden de compra vinculada no existe.');
    }
    if (ordenCompra.supplier_id !== supplierId) {
      throw conflicto('La orden de compra seleccionada no corresponde al proveedor indicado.');
    }
    if (ordenCompra.purchase_order_status !== 'APROBADA') {
      throw conflicto(
        `Solo se pueden facturar órdenes en estado APROBADA (estado actual: ${ordenCompra.purchase_order_status}).`
      );
    }
  }

  // ---- 3. Duplicados ----
  const yaExiste = await prisma.supplier_voucher.findFirst({
    where: {
      supplier_id: supplierId,
      voucher_type_id: typeId,
      voucher_point_of_sale: puntoVenta,
      voucher_number: numero,
    },
  });

  if (yaExiste) {
    throw conflicto(
      `El proveedor ya tiene registrado el comprobante ${tipo.voucher_type} ${puntoVenta}-${numero}.`
    );
  }

  // Empaquetar observaciones + ítems facturados
  const observacionesEmpaquetadas = empaquetarObservaciones(
    payload.observations ?? payload.observaciones,
    items
  );

  // ---- 4. Alta en transacción ----
  return prisma.$transaction(async (tx) => {
    const comprobante = await tx.supplier_voucher.create({
      data: {
        supplier_id: supplierId,
        voucher_type_id: typeId,
        voucher_point_of_sale: puntoVenta,
        voucher_number: numero,
        issue_date: emision,
        due_date: vencimiento,
        total_amount: importe,
        purchase_order_id: purchaseOrderId || null,
        observations: observacionesEmpaquetadas,
        employees_id: employeeId,
      },
      include: {
        suppliers: { select: { supplier_legal_name: true, supplier_trade_name: true } },
        voucher_type: true,
      },
    });

    if (tipo.affects_account) {
      await tx.supplier_account_movement.create({
        data: {
          supplier_id: supplierId,
          concept: `${tipo.voucher_type} ${puntoVenta}-${numero}`,
          debit: tipo.sign === 1 ? importe : 0,
          credit: tipo.sign === -1 ? importe : 0,
          voucher_id: comprobante.voucher_id,
          employees_id: employeeId,
        },
      });
    }

    return comprobante;
  });
};

module.exports = {
  listar,
  obtener,
  ordenesCompraAprobadas,
  crear,
};