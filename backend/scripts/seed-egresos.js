/**
 * Carga ejemplos para el módulo Reportes/Egresos.
 *
 * Crea datos de prueba coherentes con la lógica del reporte:
 *   - Facturas de proveedores pagables (supplier_voucher)
 *   - Órdenes de compra (para la categoría COMPRAS_STOCK)
 *   - Gastos operativos con su reparto sobre comprobantes (GASTOS_OPERATIVOS)
 *   - Órdenes de pago confirmadas en el pasado (PROVEEDORES / base de todo)
 *
 * Los triggers de la base mantienen la consistencia: el total de la orden,
 * el estado del comprobante (PENDIENTE/PAGADO) y la validación de que el
 * comprobante sea del mismo proveedor y no supere el saldo pendiente.
 *
 * Uso (desde backend/):
 *   node scripts/seed-egresos.js            # cargar ejemplos
 *   node scripts/seed-egresos.js --limpiar  # borrar solo los ejemplos
 *
 * Es idempotente: si ya hay ejemplos cargados, no duplica nada.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PREFIJO_ORDEN = 'OP-DEMO';
const PREFIJO_OC = 'OC-DEMO';
const MARCA_VOUCHER = 'Ejemplo Reporte/Egresos';

// América/Argentina/Buenos_Aires (UTC-3 todo el año).
const AR = '-03:00';
const dt = (fechaISO, hora = '10:00:00') => new Date(`${fechaISO}T${hora}${AR}`);
const soloFecha = (fechaISO) => new Date(`${fechaISO}T12:00:00${AR}`);

// ---------------------------------------------------------------------------
// Datos de ejemplo
// ---------------------------------------------------------------------------

// Proveedores de servicios (no existen en la semilla original).
const PROVEEDORES_NUEVOS = [
  {
    cuit: '30-11122233-4', legal: 'Energía del Norte S.A.', trade: 'EDENSA',
    email: 'facturacion@edensa.com', telefono: '0800-555-0100',
    direccion: 'Av. Belgrano 900, Salta',
  },
  {
    cuit: '30-99887766-2', legal: 'Gas del Sur S.R.L.', trade: 'Gas del Sur',
    email: 'admin@gassur.com', telefono: '0800-555-0200',
    direccion: 'Av. Paraguay 1200, Salta',
  },
];

// Órdenes de compra: su existencia clasifica el pago como COMPRAS_STOCK.
// Items: [descripción, cantidad, precio unitario, código de artículo (opcional)]
const ORDENES_COMPRA = [
  {
    numero: 'OC-DEMO-1001', proveedorCuit: '30-58963214-5', fecha: '2026-02-02',
    estado: 'RECIBIDA', observaciones: 'Reposición de frigobar (ejemplo)',
    items: [
      ['Agua mineral sin gas 500ml', 2500, 80, 'FRI-001'],
      ['Vino Malbec Reserva 750ml', 300, 600, 'FRI-002'],
    ],
  },
  {
    numero: 'OC-DEMO-1002', proveedorCuit: '30-65498732-1', fecha: '2026-03-10',
    estado: 'RECIBIDA', observaciones: 'Insumos de limpieza para gobernanta (ejemplo)',
    items: [
      ['Detergente multiuso concentrado 5L', 400, 250, 'LIM-001'],
      ['Desinfectante de pisos 1L', 200, 400, null],
    ],
  },
  {
    numero: 'OC-DEMO-1003', proveedorCuit: '30-58963214-5', fecha: '2026-05-15',
    estado: 'RECIBIDA', observaciones: 'Gaseosas y aguas para minibar (ejemplo)',
    items: [
      ['Gaseosa cola 1.5L', 2000, 95, null],
      ['Agua con gas 500ml', 2000, 50, 'FRI-001'],
    ],
  },
  {
    numero: 'OC-DEMO-1004', proveedorCuit: '30-58963214-5', fecha: '2026-09-01',
    estado: 'RECIBIDA', observaciones: 'Snacks y frutos secos (ejemplo)',
    items: [
      ['Snacks mixtos 100g', 500, 250, null],
      ['Frutos secos 250g', 250, 200, null],
    ],
  },
];

// Comprobantes de proveedor. `gastoAsignado` es la parte que se contabiliza
// como GASTOS_OPERATIVOS; el resto del pago queda como PROVEEDORES o
// COMPRAS_STOCK según tenga orden de compra.
const COMPROBANTES = [
  // Textil Norte — FACTURA_A
  { nro: '0000101', cuit: '30-71123456-8', tipo: 1, emision: '2026-02-05', venc: '2026-03-07', total: 450000, oc: null, gastoAsignado: 0 },
  { nro: '0000102', cuit: '30-71123456-8', tipo: 1, emision: '2026-04-08', venc: '2026-05-08', total: 260000, oc: null, gastoAsignado: 100000 },
  { nro: '0000103', cuit: '30-71123456-8', tipo: 1, emision: '2026-08-14', venc: '2026-09-13', total: 310000, oc: null, gastoAsignado: 0 },
  // Química Salta — FACTURA_B
  { nro: '0000201', cuit: '30-65498732-1', tipo: 2, emision: '2026-03-12', venc: '2026-04-11', total: 180000, oc: 'OC-DEMO-1002', gastoAsignado: 0 },
  { nro: '0000202', cuit: '30-65498732-1', tipo: 2, emision: '2026-06-05', venc: '2026-07-05', total: 150000, oc: null, gastoAsignado: 0 },
  { nro: '0000203', cuit: '30-65498732-1', tipo: 2, emision: '2026-09-18', venc: '2026-10-18', total: 120000, oc: null, gastoAsignado: 60000 },
  // Bebidas NOA — FACTURA_A
  { nro: '0000301', cuit: '30-58963214-5', tipo: 1, emision: '2026-02-04', venc: '2026-03-06', total: 380000, oc: 'OC-DEMO-1001', gastoAsignado: 0 },
  { nro: '0000302', cuit: '30-58963214-5', tipo: 1, emision: '2026-05-15', venc: '2026-06-14', total: 290000, oc: 'OC-DEMO-1003', gastoAsignado: 0 },
  { nro: '0000303', cuit: '30-58963214-5', tipo: 1, emision: '2026-09-02', venc: '2026-10-02', total: 175000, oc: 'OC-DEMO-1004', gastoAsignado: 0 },
  // Energía del Norte — FACTURA_B (servicios → gasto operativo)
  { nro: '0000401', cuit: '30-11122233-4', tipo: 2, emision: '2026-02-28', venc: '2026-03-15', total: 210000, oc: null, gastoAsignado: 210000 },
  { nro: '0000402', cuit: '30-11122233-4', tipo: 2, emision: '2026-07-31', venc: '2026-08-15', total: 225000, oc: null, gastoAsignado: 225000 },
  // Gas del Sur — FACTURA_B (servicios → gasto operativo)
  { nro: '0000501', cuit: '30-99887766-2', tipo: 2, emision: '2026-04-30', venc: '2026-05-15', total: 95000, oc: null, gastoAsignado: 95000 },
];

// Gastos operativos. `comprobante` es el número de factura y `asignado`
// el importe de esa factura que se imputa al gasto.
const GASTOS = [
  { descripcion: 'Electricidad — período febrero 2026', categoria: 3, cuitProveedor: '30-11122233-4', fecha: '2026-02-28', comprobante: '0000401', asignado: 210000 },
  { descripcion: 'Reposición de toallones — planta alta', categoria: 2, cuitProveedor: '30-71123456-8', fecha: '2026-04-08', comprobante: '0000102', asignado: 100000 },
  { descripcion: 'Gas — período abril 2026', categoria: 3, cuitProveedor: '30-99887766-2', fecha: '2026-04-30', comprobante: '0000501', asignado: 95000 },
  { descripcion: 'Electricidad — período julio 2026', categoria: 3, cuitProveedor: '30-11122233-4', fecha: '2026-07-31', comprobante: '0000402', asignado: 225000 },
  { descripcion: 'Insumos de limpieza — septiembre 2026', categoria: 1, cuitProveedor: '30-65498732-1', fecha: '2026-09-18', comprobante: '0000203', asignado: 60000 },
];

// Órdenes de pago confirmadas. El reporte las cuenta por confirmed_date.
// `detalles`: [número de comprobante, importe aplicado]
const ORDENES_PAGO = [
  { referencia: 'OP-DEMO-01', cuit: '30-58963214-5', metodo: 2, fecha: '2026-02-10', confirmada: '2026-02-10T10:15:00', observaciones: 'Transferencia de ejemplo · operación 000123', detalles: [['0000301', 380000]] },
  { referencia: 'OP-DEMO-02', cuit: '30-71123456-8', metodo: 3, fecha: '2026-02-18', confirmada: '2026-02-18T11:30:00', observaciones: 'Cheque propio 0002345', detalles: [['0000101', 450000]] },
  { referencia: 'OP-DEMO-03', cuit: '30-11122233-4', metodo: 2, fecha: '2026-03-05', confirmada: '2026-03-05T09:00:00', observaciones: 'Transferencia de ejemplo · operación 000456', detalles: [['0000401', 210000]] },
  { referencia: 'OP-DEMO-04', cuit: '30-65498732-1', metodo: 2, fecha: '2026-03-20', confirmada: '2026-03-20T14:45:00', observaciones: 'Transferencia de ejemplo · operación 000789', detalles: [['0000201', 180000]] },
  { referencia: 'OP-DEMO-05', cuit: '30-71123456-8', metodo: 2, fecha: '2026-04-14', confirmada: '2026-04-14T10:00:00', observaciones: 'Transferencia de ejemplo · operación 000912', detalles: [['0000102', 260000]] },
  { referencia: 'OP-DEMO-06', cuit: '30-99887766-2', metodo: 1, fecha: '2026-05-08', confirmada: '2026-05-08T16:20:00', observaciones: 'Pago en efectivo de caja', detalles: [['0000501', 95000]] },
  { referencia: 'OP-DEMO-07', cuit: '30-58963214-5', metodo: 2, fecha: '2026-05-22', confirmada: '2026-05-22T11:00:00', observaciones: 'Transferencia de ejemplo · operación 001034', detalles: [['0000302', 290000]] },
  { referencia: 'OP-DEMO-08', cuit: '30-65498732-1', metodo: 3, fecha: '2026-06-11', confirmada: '2026-06-11T10:30:00', observaciones: 'Cheque propio 0002401', detalles: [['0000202', 150000]] },
  { referencia: 'OP-DEMO-09', cuit: '30-11122233-4', metodo: 2, fecha: '2026-08-07', confirmada: '2026-08-07T09:15:00', observaciones: 'Transferencia de ejemplo · operación 001456', detalles: [['0000402', 225000]] },
  { referencia: 'OP-DEMO-10', cuit: '30-71123456-8', metodo: 2, fecha: '2026-08-21', confirmada: '2026-08-21T13:00:00', observaciones: 'Transferencia de ejemplo · operación 001678', detalles: [['0000103', 310000]] },
  { referencia: 'OP-DEMO-11', cuit: '30-58963214-5', metodo: 2, fecha: '2026-09-09', confirmada: '2026-09-09T10:45:00', observaciones: 'Transferencia de ejemplo · operación 001901', detalles: [['0000303', 175000]] },
  { referencia: 'OP-DEMO-12', cuit: '30-65498732-1', metodo: 2, fecha: '2026-09-25', confirmada: '2026-09-25T15:30:00', observaciones: 'Transferencia de ejemplo · operación 002112', detalles: [['0000203', 120000]] },
];

// ---------------------------------------------------------------------------
// Carga
// ---------------------------------------------------------------------------

async function cargar() {
  const yaExiste = await prisma.payment_order.findFirst({
    where: { payment_reference: { startsWith: PREFIJO_ORDEN } },
  });
  if (yaExiste) {
    console.log('Los ejemplos ya están cargados (primera orden de pago #' + yaExiste.payment_order_id + ').');
    console.log('Para recargar desde cero: node scripts/seed-egresos.js --limpiar y luego volver a ejecutar.');
    return;
  }

  // Catálogos necesarios para armar las claves foráneas.
  const metodos = await prisma.payment_method.findMany();
  const nombreMetodo = new Map(metodos.map((m) => [m.payment_method_id, m.payment_method]));
  const articulos = await prisma.articles.findMany({ select: { article_id: true, article_code: true } });
  const idArticulo = new Map(articulos.map((a) => [a.article_code, a.article_id]));

  await prisma.$transaction(async (tx) => {
    // 1. Proveedores de servicios (idempotente por CUIT).
    for (const p of PROVEEDORES_NUEVOS) {
      await tx.suppliers.upsert({
        where: { supplier_cuit: p.cuit },
        update: {},
        create: {
          supplier_legal_name: p.legal, supplier_trade_name: p.trade, supplier_cuit: p.cuit,
          supplier_email: p.email, supplier_phone: p.telefono, supplier_address: p.direccion,
        },
      });
    }
    const todosLosProveedores = await tx.suppliers.findMany({
      select: { supplier_id: true, supplier_cuit: true },
    });
    const idPorCuit = new Map(todosLosProveedores.map((s) => [s.supplier_cuit, s.supplier_id]));

    // 2. Órdenes de compra (clasifican el pago como COMPRAS_STOCK).
    const idPorOC = new Map();
    for (const oc of ORDENES_COMPRA) {
      const creada = await tx.purchase_order.create({
        data: {
          purchase_order_number: oc.numero,
          supplier_id: idPorCuit.get(oc.proveedorCuit),
          issue_date: soloFecha(oc.fecha),
          purchase_conditions: 'Ejemplo de carga para reportes',
          purchase_order_status: oc.estado,
          observations: oc.observaciones,
          employees_id: 2, // Mariana López (encargado de stock)
        },
      });
      idPorOC.set(oc.numero, creada.purchase_order_id);
      for (const [descripcion, cantidad, precio, codigo] of oc.items) {
        await tx.purchase_order_detail.create({
          data: {
            purchase_order_id: creada.purchase_order_id,
            article_id: codigo ? (idArticulo.get(codigo) ?? null) : null,
            item_description: descripcion,
            quantity: cantidad,
            unit_price: precio,
          },
        });
      }
      await tx.purchase_order_status_history.create({
        data: {
          purchase_order_id: creada.purchase_order_id,
          previous_status: 'BORRADOR',
          new_status: oc.estado,
          employees_id: 2,
          reason: 'Ejemplo: orden recibida en depósito',
        },
      });
    }

    // 3. Comprobantes de proveedor (el trigger los deja en PENDIENTE).
    const idPorVoucher = new Map();
    for (const c of COMPROBANTES) {
      const creado = await tx.supplier_voucher.create({
        data: {
          supplier_id: idPorCuit.get(c.cuit),
          voucher_type_id: c.tipo,
          voucher_point_of_sale: '0001',
          voucher_number: c.nro,
          issue_date: soloFecha(c.emision),
          due_date: soloFecha(c.venc),
          total_amount: c.total,
          paid_amount: 0,
          employees_id: 1, // Carlos Gómez
          purchase_order_id: c.oc ? idPorOC.get(c.oc) : null,
          observations: MARCA_VOUCHER,
        },
      });
      idPorVoucher.set(c.nro, creado.voucher_id);
    }

    // 4. Gastos operativos y su reparto sobre comprobantes.
    const gastosCreados = [];
    for (const g of GASTOS) {
      const gasto = await tx.expense.create({
        data: {
          expense_category_id: g.categoria,
          supplier_id: idPorCuit.get(g.cuitProveedor),
          expense_date: soloFecha(g.fecha),
          description: g.descripcion,
          employees_id: 1,
        },
      });
      await tx.expense_voucher.create({
        data: {
          expense_id: gasto.expense_id,
          voucher_id: idPorVoucher.get(g.comprobante),
          allocated_amount: g.asignado,
        },
      });
      gastosCreados.push(gasto);
    }

    // 5. Órdenes de pago: primero en borrador (el trigger valida los
    //    renglones), luego se confirman con fecha en el pasado.
    const ordenesCreadas = [];
    for (const op of ORDENES_PAGO) {
      const orden = await tx.payment_order.create({
        data: {
          supplier_id: idPorCuit.get(op.cuit),
          payment_method_id: op.metodo,
          payment_date: soloFecha(op.fecha),
          payment_reference: op.referencia,
          observations: op.observaciones,
          employees_id: 1,
          payment_order_status: 0, // BORRADOR
        },
      });
      for (const [nroComprobante, importe] of op.detalles) {
        await tx.payment_order_detail.create({
          data: {
            payment_order_id: orden.payment_order_id,
            voucher_id: idPorVoucher.get(nroComprobante),
            applied_amount: importe,
          },
        });
      }
      ordenesCreadas.push({ orden, op });
    }

    // 6. Confirmar: estado 1, fecha de confirmación en el pasado (el
    //    reporte agrupa por esta fecha en zona argentina).
    for (const { orden, op } of ordenesCreadas) {
      const [fechaISO, hora] = op.confirmada.split('T');
      await tx.payment_order.update({
        where: { payment_order_id: orden.payment_order_id },
        data: {
          payment_order_status: 1, // CONFIRMADA
          payment_date: soloFecha(op.fecha),
          confirmed_date: dt(fechaISO, hora),
        },
      });
      // Movimiento en cuenta corriente (crédito: cancela la deuda).
      await tx.supplier_account_movement.create({
        data: {
          supplier_id: idPorCuit.get(op.cuit),
          concept: `Orden de pago #${orden.payment_order_id} — ${nombreMetodo.get(op.metodo)} (ejemplo)`,
          credit: op.detalles.reduce((suma, [, importe]) => suma + importe, 0),
          debit: 0,
          payment_order_id: orden.payment_order_id,
          employees_id: 1,
          movement_date: dt(...op.confirmada.split('T')),
        },
      });
    }

    // 7. Cerrar los comprobantes pagados (el trigger pasa el estado a PAGADO).
    for (const op of ORDENES_PAGO) {
      for (const [nroComprobante, importe] of op.detalles) {
        await tx.supplier_voucher.update({
          where: { voucher_id: idPorVoucher.get(nroComprobante) },
          data: { paid_amount: { increment: importe } },
        });
      }
    }

    // 8. Vincular cada gasto con la orden de pago que lo canceló.
    const gastoPorComprobante = new Map(GASTOS.map((g) => [g.comprobante, g]));
    for (const op of ORDENES_PAGO) {
      for (const [nroComprobante] of op.detalles) {
        const gasto = GASTOS.find((g) => g.comprobante === nroComprobante);
        if (!gasto) continue;
        const fila = gastosCreados.find((f) => f.description === gasto.descripcion);
        await tx.expense_payment_order.create({
          data: { expense_id: fila.expense_id, payment_order_id: ordenesCreadas.find((o) => o.op === op).orden.payment_order_id },
        });
      }
    }
  });

  // Resumen esperado del reporte (período 2026-01-01 a hoy, agrupación MES).
  const total = ORDENES_PAGO.reduce((s, op) => s + op.detalles.reduce((a, [, i]) => a + i, 0), 0);
  console.log('Ejemplos cargados para Reportes/Egresos:');
  console.log(`  · ${PROVEEDORES_NUEVOS.length} proveedores nuevos (EDENSA, Gas del Sur)`);
  console.log(`  · ${ORDENES_COMPRA.length} órdenes de compra (COMPRAS_STOCK)`);
  console.log(`  · ${COMPROBANTES.length} comprobantes de proveedor`);
  console.log(`  · ${GASTOS.length} gastos operativos con reparto sobre comprobantes`);
  console.log(`  · ${ORDENES_PAGO.length} órdenes de pago confirmadas (feb–sep 2026)`);
  console.log(`Total del período: $ ${total.toLocaleString('es-AR')}`);
  console.log('Abrí /reportes/egresos en el frontend para ver el reporte.');
}

// ---------------------------------------------------------------------------
// Limpieza: borra solo lo que creó este script.
// ---------------------------------------------------------------------------

async function limpiar() {
  const ordenes = await prisma.payment_order.findMany({
    where: { payment_reference: { startsWith: PREFIJO_ORDEN } },
    select: { payment_order_id: true },
  });
  const idsOrdenes = ordenes.map((o) => o.payment_order_id);
  const vouchers = await prisma.supplier_voucher.findMany({
    where: { observations: MARCA_VOUCHER },
    select: { voucher_id: true },
  });
  const idsVouchers = vouchers.map((v) => v.voucher_id);
  const gastos = await prisma.expense.findMany({
    where: { expense_voucher: { some: { voucher_id: { in: idsVouchers } } } },
    select: { expense_id: true },
  });
  const idsGastos = gastos.map((g) => g.expense_id);
  const ocs = await prisma.purchase_order.findMany({
    where: { purchase_order_number: { startsWith: PREFIJO_OC } },
    select: { purchase_order_id: true },
  });
  const idsOcs = ocs.map((o) => o.purchase_order_id);

  if (!idsOrdenes.length && !idsVouchers.length && !idsOcs.length) {
    console.log('No hay ejemplos de egresos cargados.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (idsGastos.length) {
      await tx.expense_payment_order.deleteMany({ where: { expense_id: { in: idsGastos } } });
      await tx.expense_voucher.deleteMany({ where: { expense_id: { in: idsGastos } } });
      await tx.expense.deleteMany({ where: { expense_id: { in: idsGastos } } });
    }
    if (idsOrdenes.length) {
      await tx.supplier_account_movement.deleteMany({ where: { payment_order_id: { in: idsOrdenes } } });
      await tx.payment_order_detail.deleteMany({ where: { payment_order_id: { in: idsOrdenes } } });
      await tx.payment_order.deleteMany({ where: { payment_order_id: { in: idsOrdenes } } });
    }
    if (idsVouchers.length) {
      await tx.supplier_voucher.deleteMany({ where: { voucher_id: { in: idsVouchers } } });
    }
    if (idsOcs.length) {
      await tx.purchase_order_status_history.deleteMany({ where: { purchase_order_id: { in: idsOcs } } });
      await tx.purchase_order_detail.deleteMany({ where: { purchase_order_id: { in: idsOcs } } });
      await tx.purchase_order.deleteMany({ where: { purchase_order_id: { in: idsOcs } } });
    }
    // Proveedores creados por el ejemplo, solo si ya no les queda nada.
    for (const p of PROVEEDORES_NUEVOS) {
      await tx.suppliers.deleteMany({
        where: { supplier_cuit: p.cuit, supplier_voucher: { none: {} } },
      });
    }
  });

  console.log('Ejemplos de egresos eliminados.');
}

// ---------------------------------------------------------------------------

(async () => {
  try {
    if (process.argv.includes('--limpiar')) {
      await limpiar();
    } else {
      await cargar();
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
