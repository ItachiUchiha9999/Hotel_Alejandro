const prisma = require('../../db/prisma');
const { Prisma } = require('@prisma/client');
const { invalido } = require('../../utils/AppError');
const { toId } = require('../../utils/parse');

const fechaValidaISO = (str, nombre = 'fecha') => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str || '')) {
    throw invalido(`La ${nombre} debe tener formato YYYY-MM-DD.`);
  }
  const fecha = new Date(`${str}T00:00:00.000Z`);
  if (Number.isNaN(fecha.getTime())) {
    throw invalido(`La ${nombre} no es válida.`);
  }
  return str;
};

/**
 * REP-08 — Análisis de Ocupación e Ingresos por Temporada y Tipo de Habitación.
 * 
 * Cruza reservas activas/efectivas con la tarifa y temporada asociada (o GENERAL por defecto),
 * calcula noches ocupadas, ingresos generados, ADR y % de ocupación sobre el total disponible.
 */
const ocupacionPorTemporadas = async ({ desde, hasta, temporada, tipo } = {}) => {
  const hoyStr = new Date().toISOString().slice(0, 10);
  
  // Rango de fechas por defecto: mes corriente si no se envía
  const fechaDesde = desde ? fechaValidaISO(desde, 'fecha desde') : `${hoyStr.slice(0, 7)}-01`;
  const fechaHasta = hasta ? fechaValidaISO(hasta, 'fecha hasta') : hoyStr;

  if (fechaDesde > fechaHasta) {
    throw invalido('La fecha desde no puede ser posterior a la fecha hasta.');
  }

  const roomTypeId = toId(tipo);
  const temporadaFiltro = temporada && temporada !== 'TODAS' ? String(temporada).toUpperCase().trim() : null;

  // 1. Obtener la cantidad de habitaciones activas por tipo para calcular capacidad disponible
  const tiposHabitacion = await prisma.room_type.findMany({
    where: roomTypeId ? { room_type_id: roomTypeId } : { room_type_state: true },
    include: {
      _count: {
        select: {
          rooms: { where: { active: true } },
        },
      },
    },
    orderBy: { room_type_name: 'asc' },
  });

  // Días totales del período analizado
  const msPorDia = 86400000;
  const diasPeriodo = Math.max(
    1,
    Math.round((new Date(fechaHasta).getTime() - new Date(fechaDesde).getTime()) / msPorDia) + 1
  );

  // 2. Consulta agregada a nivel SQL con snapshots reales de reservas y temporadas
  const filas = await prisma.$queryRaw`
    SELECT
      rt.room_type_id,
      rt.room_type_name,
      COALESCE(rtr.season_name, 'GENERAL') AS season_name,
      COUNT(r.reservation_id)::int AS total_reservas,
      -- Suma de noches que caen dentro del rango solicitado
      SUM(
        GREATEST(
          0,
          LEAST(r.check_out_date, ${fechaHasta}::date + 1) - GREATEST(r.check_in_date, ${fechaDesde}::date)
        )
      )::int AS noches_ocupadas,
      -- Ingresos de alojamiento correspondientes a esas noches
      SUM(
        GREATEST(
          0,
          LEAST(r.check_out_date, ${fechaHasta}::date + 1) - GREATEST(r.check_in_date, ${fechaDesde}::date)
        ) * r.price_per_night
      )::numeric AS ingresos_alojamiento
    FROM "reservation" r
    JOIN "room" rm ON rm.room_id = r.room_id
    JOIN "room_type" rt ON rt.room_type_id = rm.room_type_id
    LEFT JOIN "room_type_rate" rtr ON rtr.rate_id = r.rate_id
    WHERE r.reservation_status IN ('CONFIRMADA', 'IN_HOUSE', 'FINALIZADA')
      AND r.check_in_date <= ${fechaHasta}::date
      AND r.check_out_date >= ${fechaDesde}::date
      AND (${roomTypeId}::int IS NULL OR rt.room_type_id = ${roomTypeId})
      AND (${temporadaFiltro}::text IS NULL OR COALESCE(rtr.season_name, 'GENERAL') = ${temporadaFiltro})
    GROUP BY rt.room_type_id, rt.room_type_name, COALESCE(rtr.season_name, 'GENERAL')
    ORDER BY rt.room_type_name ASC, season_name ASC
  `;

  // Mapeo y cálculo de KPIs de hospitalidad (ADR, Tasa de Ocupación, RevPAR)
  let totalNochesOcupadas = 0;
  let totalIngresos = 0;
  let totalCapacidadNoches = 0;

  // Capacidad de todo el hotel o de los tipos filtrados en ese rango
  tiposHabitacion.forEach((t) => {
    totalCapacidadNoches += t._count.rooms * diasPeriodo;
  });

  const desglose = filas.map((f) => {
    const noches = Number(f.noches_ocupadas || 0);
    const ingresos = Number(f.ingresos_alojamiento || 0);
    const tipoObj = tiposHabitacion.find((t) => t.room_type_id === f.room_type_id);
    const habsActivas = tipoObj ? tipoObj._count.rooms : 0;
    const nochesDisponiblesTipo = habsActivas * diasPeriodo;

    const adr = noches > 0 ? Math.round((ingresos / noches) * 100) / 100 : 0;
    const tasaOcupacion = nochesDisponiblesTipo > 0
      ? Math.round((noches / nochesDisponiblesTipo) * 1000) / 10
      : 0;

    totalNochesOcupadas += noches;
    totalIngresos += ingresos;

    return {
      room_type_id: f.room_type_id,
      room_type_name: f.room_type_name,
      season_name: f.season_name,
      total_reservas: Number(f.total_reservas || 0),
      noches_ocupadas: noches,
      noches_disponibles: nochesDisponiblesTipo,
      tasa_ocupacion_pct: tasaOcupacion,
      ingresos_alojamiento: ingresos,
      adr, // Tarifa promedio por noche
    };
  });

  const tasaOcupacionGlobal = totalCapacidadNoches > 0
    ? Math.round((totalNochesOcupadas / totalCapacidadNoches) * 1000) / 10
    : 0;

  const adrGlobal = totalNochesOcupadas > 0
    ? Math.round((totalIngresos / totalNochesOcupadas) * 100) / 100
    : 0;

  return {
    filtros: {
      desde: fechaDesde,
      hasta: fechaHasta,
      temporada: temporadaFiltro || 'TODAS',
      tipo: roomTypeId || 'TODOS',
      dias_periodo: diasPeriodo,
    },
    resumen: {
      noches_ocupadas: totalNochesOcupadas,
      capacidad_total_noches: totalCapacidadNoches,
      tasa_ocupacion_global_pct: tasaOcupacionGlobal,
      ingresos_totales_alojamiento: totalIngresos,
      adr_global: adrGlobal,
      revpar: totalCapacidadNoches > 0
        ? Math.round((totalIngresos / totalCapacidadNoches) * 100) / 100
        : 0,
    },
    desglose,
  };
};

module.exports = {
  ocupacionPorTemporadas,
};