const prisma = require('../../db/prisma');
const { invalido } = require('../../utils/AppError');
const { consultar: consultarEgresos } = require('../egresos/egresos.fuente');
const { calcularTotales, generarSerie } = require('./finanzas.reglas');

const fechaISO = (valor) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor || '')) return null;
  const fecha = new Date(`${valor}T00:00:00.000Z`);
  return Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor ? null : fecha;
};
const fechaTexto = (fecha) => fecha.toISOString().slice(0, 10);

const movimientosEntre = async (inicio, fin) => {
  const desdeLocal = new Date(inicio.getTime() + 3 * 60 * 60 * 1000);
  const hastaLocal = new Date(fin.getTime() + 3 * 60 * 60 * 1000);
  const [ingresos, egresos] = await Promise.all([prisma.$queryRaw`
  SELECT TO_CHAR((rp.paid_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM-DD') AS fecha, 'INGRESO' AS tipo,
         'Alojamiento · ' || r.reservation_code AS detalle, rp.amount::numeric AS importe
  FROM "reservation_payment" rp JOIN "reservation" r ON r.reservation_id = rp.reservation_id
  WHERE rp.paid_at >= ${desdeLocal} AND rp.paid_at < ${hastaLocal}
  UNION ALL
  SELECT TO_CHAR((c.paid_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM-DD') AS fecha, 'INGRESO' AS tipo,
         'Servicio · ' || c.service_name || ' · ' || r.reservation_code AS detalle, c.total_amount::numeric AS importe
  FROM "room_service_charge" c JOIN "reservation" r ON r.reservation_id = c.reservation_id
  WHERE c.paid_at >= ${desdeLocal} AND c.paid_at < ${hastaLocal}
`, consultarEgresos(
    desdeLocal.toISOString().slice(0, 10),
    new Date(hastaLocal.getTime() - 86400000).toISOString().slice(0, 10),
  )]);
  const nombresCategoria = {
    PROVEEDORES: 'Pago a proveedor',
    COMPRAS_STOCK: 'Compra de stock',
    GASTOS_OPERATIVOS: 'Gasto operativo',
  };
  return [
    ...ingresos,
    ...egresos.map(movimiento => ({
      fecha: movimiento.fecha,
      tipo: 'EGRESO',
      detalle: `${nombresCategoria[movimiento.categoria]} · ${movimiento.detalle}`,
      importe: movimiento.importe,
    })),
  ];
};

const consultarFinanzas = async ({ periodo = 'MES', fecha } = {}) => {
  const modo = String(periodo).toUpperCase();
  if (!['SEMANA', 'MES'].includes(modo)) throw invalido('El período debe ser SEMANA o MES.');
  const elegida = fecha ? fechaISO(String(fecha)) : new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  if (!elegida) throw invalido('La fecha debe tener formato YYYY-MM-DD.');

  let inicio;
  let dias;
  if (modo === 'SEMANA') {
    inicio = new Date(elegida);
    inicio.setUTCDate(inicio.getUTCDate() - ((inicio.getUTCDay() + 6) % 7));
    dias = 7;
  } else {
    inicio = new Date(Date.UTC(elegida.getUTCFullYear(), elegida.getUTCMonth(), 1));
    dias = new Date(Date.UTC(elegida.getUTCFullYear(), elegida.getUTCMonth() + 1, 0)).getUTCDate();
  }
  const fin = new Date(inicio);
  fin.setUTCDate(fin.getUTCDate() + dias);
  const previoFin = new Date(inicio);
  const previoInicio = new Date(inicio);
  if (modo === 'MES') {
    previoInicio.setUTCMonth(previoInicio.getUTCMonth() - 1);
    previoFin.setTime(inicio.getTime());
  } else {
    previoInicio.setUTCDate(previoInicio.getUTCDate() - dias);
  }

  const [actualRaw, anteriorRaw] = await Promise.all([
    movimientosEntre(inicio, fin), movimientosEntre(previoInicio, previoFin),
  ]);
  const serie = generarSerie(inicio, dias, actualRaw);
  return {
    periodo: modo,
    desde: fechaTexto(inicio),
    hasta: fechaTexto(new Date(fin.getTime() - 86400000)),
    serie,
    totales: calcularTotales(actualRaw),
    comparacion: { desde: fechaTexto(previoInicio), hasta: fechaTexto(new Date(previoFin.getTime() - 86400000)), totales: calcularTotales(anteriorRaw) },
    movimientos: actualRaw.map((m) => ({ ...m, importe: Number(m.importe) }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha)),
  };
};

module.exports = { consultarFinanzas };
