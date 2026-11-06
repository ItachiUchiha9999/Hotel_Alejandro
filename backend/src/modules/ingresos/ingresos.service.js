const prisma = require('../../db/prisma');
const { validarFiltros, generarReporte } = require('./ingresos.reglas');

async function consultar(filtros) {
  const seleccion = validarFiltros(filtros);
  // Una única consulta obtiene ambas ventanas con un mismo snapshot de la base.
  const filas = await prisma.$queryRaw`
    SELECT 'R-' || rp.reservation_payment_id AS id,
           TO_CHAR(rp.paid_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') AS fecha,
           'RESERVAS' AS origen, 'Cobro de alojamiento' AS detalle,
           r.reservation_code AS reserva, rp.amount AS importe
    FROM reservation_payment rp JOIN reservation r ON r.reservation_id = rp.reservation_id
    WHERE rp.paid_at >= (${seleccion.anterior_desde}::date::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
      AND rp.paid_at < ((${seleccion.hasta}::date + 1)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
    UNION ALL
    SELECT 'S-' || c.charge_id AS id,
           TO_CHAR(c.paid_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') AS fecha,
           CASE WHEN sc.category IN ('MINIBAR', 'GASTRONOMIA') THEN 'CONSUMOS' ELSE 'SERVICIOS' END AS origen,
           c.service_name AS detalle, r.reservation_code AS reserva, c.total_amount AS importe
    FROM room_service_charge c
    JOIN reservation r ON r.reservation_id = c.reservation_id
    JOIN room_service_catalog sc ON sc.service_id = c.service_id
    WHERE c.paid_at >= (${seleccion.anterior_desde}::date::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
      AND c.paid_at < ((${seleccion.hasta}::date + 1)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')`;
  return generarReporte(seleccion, filas);
}

module.exports = { consultar };
