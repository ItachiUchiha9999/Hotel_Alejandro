const prisma = require('../../db/prisma');

async function consultar(desde, hasta) {
  return prisma.$queryRaw`
    WITH gastos_por_comprobante AS (
      SELECT ev.voucher_id,
             SUM(ev.allocated_amount) AS importe_operativo
      FROM expense_voucher ev
      JOIN expense e ON e.expense_id = ev.expense_id
      WHERE e.expense_status <> 'ANULADO'
      GROUP BY ev.voucher_id
    ), pagos AS (
      SELECT po.payment_order_id,
             pd.detail_id,
             pd.voucher_id,
             TO_CHAR(po.confirmed_date AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') AS fecha,
             COALESCE(s.supplier_trade_name, s.supplier_legal_name) AS proveedor,
             sv.voucher_point_of_sale || '-' || sv.voucher_number AS comprobante,
             sv.purchase_order_id,
             sv.total_amount,
             pd.applied_amount,
             ROUND(
               pd.applied_amount * LEAST(COALESCE(gpc.importe_operativo, 0), sv.total_amount)
               / NULLIF(sv.total_amount, 0),
               2
             ) AS importe_operativo
      FROM payment_order po
      JOIN payment_order_detail pd ON pd.payment_order_id = po.payment_order_id
      JOIN supplier_voucher sv ON sv.voucher_id = pd.voucher_id
      JOIN suppliers s ON s.supplier_id = po.supplier_id
      LEFT JOIN gastos_por_comprobante gpc ON gpc.voucher_id = sv.voucher_id
      WHERE po.payment_order_status = 1
        AND po.confirmed_date >= (${desde}::date::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
        AND po.confirmed_date < ((${hasta}::date + 1)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
    )
    SELECT 'P-' || payment_order_id || '-' || detail_id || '-G' AS id,
           fecha,
           'GASTOS_OPERATIVOS' AS categoria,
           'Comprobante ' || comprobante || ' · ' || proveedor AS detalle,
           proveedor,
           payment_order_id,
           importe_operativo AS importe
    FROM pagos
    WHERE importe_operativo > 0
    UNION ALL
    SELECT 'P-' || payment_order_id || '-' || detail_id || '-R' AS id,
           fecha,
           CASE WHEN purchase_order_id IS NOT NULL THEN 'COMPRAS_STOCK' ELSE 'PROVEEDORES' END AS categoria,
           'Comprobante ' || comprobante || ' · ' || proveedor AS detalle,
           proveedor,
           payment_order_id,
           applied_amount - importe_operativo AS importe
    FROM pagos
    WHERE applied_amount - importe_operativo > 0
    ORDER BY fecha DESC, id`;
}

module.exports = { consultar };