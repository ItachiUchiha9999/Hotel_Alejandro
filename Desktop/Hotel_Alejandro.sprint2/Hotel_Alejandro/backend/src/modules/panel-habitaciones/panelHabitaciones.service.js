    const prisma = require('../../db/prisma');

    /**
     * HAB-04 — Panel consolidado de habitaciones.
     *
     * La base ya contiene la vista v_room_type_panel.
     * Esta vista reúne:
     * - tipo de habitación
     * - descripción
     * - capacidad
     * - tarifa vigente
     * - cantidad de habitaciones activas
     * - disponibles
     * - cantidad total
     */

    const listar = async () => {
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
        ORDER BY room_type_name ASC
    `;

    /**
     * PostgreSQL COUNT devuelve bigint.
     * JSON.stringify no puede serializar bigint directamente,
     * así que convertimos esas cantidades a Number.
     */
    return datos.map((item) => ({
        ...item,

        active_rooms: Number(item.active_rooms ?? 0),

        available_rooms: Number(
        item.available_rooms ?? 0
        ),

        total_rooms: Number(item.total_rooms ?? 0),
    }));
    };

    module.exports = {
    listar,
    };