const prisma = require('../../db/prisma');
const { Prisma } = require('@prisma/client');

/**
 * HAB-04 — Panel consolidado de habitaciones.
 *
 * Usa la vista canónica v_room_type_panel de la base de datos.
 * Criterio de aceptación: Debe permitir filtrar por estado (Activo/Inactivo).
 */
const listar = async ({ estado } = {}) => {
  let filtroSql = Prisma.empty;

  if (estado === 'ACTIVO' || estado === 'true') {
    filtroSql = Prisma.sql`WHERE active = true`;
  } else if (estado === 'INACTIVO' || estado === 'false') {
    filtroSql = Prisma.sql`WHERE active = false`;
  }

  const datos = await prisma.$queryRaw`
    SELECT
      room_type_id,
      room_type_name,
      description,
      max_capacity,
      bed_setup,
      active,
      current_price,
      currency,
      price_valid_from,
      active_rooms,
      available_rooms,
      total_rooms
    FROM v_room_type_panel
    ${filtroSql}
    ORDER BY room_type_name ASC
  `;

  /**
   * PostgreSQL COUNT devuelve bigint. Convertimos a Number para serializar en JSON.
   */
  return datos.map((item) => ({
    ...item,
    current_price: item.current_price != null ? Number(item.current_price) : null,
    active_rooms: Number(item.active_rooms ?? 0),
    available_rooms: Number(item.available_rooms ?? 0),
    total_rooms: Number(item.total_rooms ?? 0),
  }));
};

module.exports = {
  listar,
};