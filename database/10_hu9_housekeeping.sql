/**
 * Hotel Alejandro I — Sprint 3
 * HU-9 (HAB-06): Mantenimiento y limpieza de habitaciones
 *
 * Parche incremental sobre DB-hotel.pgsql. Se puede correr varias veces.
 *
 *   psql -U postgres -d sistema_hotelero_db -f database/10_hu9_housekeeping.sql
 *
 * ALCANCE
 * Solo toca objetos que son de HU-9: la tabla Room_Maintenance y sus dos
 * funciones de trigger. No modifica nada de RES-01, RES-05, RES-09 ni RES-11.
 *
 * QUÉ CORRIGE
 *   1. Un bloqueo programado a futuro cambiaba el estado de la habitación
 *      en el momento de cargarlo. Si hoy se programa una pintura para la
 *      semana que viene, la habitación pasaba a MANTENIMIENTO hoy mismo y
 *      dejaba de venderse una semana antes de tiempo.
 *   2. Al cerrar un bloqueo, la habitación volvía a DISPONIBLE aunque
 *      tuviera otro bloqueo vigente abierto.
 *   3. Una LIMPIEZA en el día chocaba con la reserva que entra ese mismo día.
 *      En un hotel la habitación se limpia a la mañana y se entrega a las
 *      14 h: la limpieza no ocupa fechas, ocupa horas. Solo MANTENIMIENTO y
 *      FUERA_DE_SERVICIO deben impedir reservas.
 */

SET client_encoding = 'UTF8';

BEGIN;

-- =====================================================================
-- 1. Estado de la habitación al abrir y cerrar un bloqueo
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_sync_room_maintenance()
RETURNS TRIGGER AS $$
DECLARE
    v_otro_vigente RECORD;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- No se bloquea una habitación con un huésped adentro.
        IF EXISTS (SELECT 1 FROM Room WHERE room_id = NEW.room_id AND room_status = 'OCUPADA') THEN
            RAISE EXCEPTION 'La habitación está ocupada: no se puede iniciar el bloqueo hasta el check-out.';
        END IF;

        /**
         * Solo cambia el estado si el bloqueo ya empezó. Uno programado a
         * futuro afecta la disponibilidad de esas fechas, pero no el estado
         * actual: lo activa fn_activate_scheduled_maintenance() el día que
         * corresponde.
         */
        IF NEW.start_date <= CURRENT_DATE AND NEW.actual_end_date IS NULL THEN
            UPDATE Room
            SET room_status = CASE NEW.maintenance_type
                                  WHEN 'LIMPIEZA'          THEN 'LIMPIEZA'
                                  WHEN 'FUERA_DE_SERVICIO' THEN 'FUERA_DE_SERVICIO'
                                  ELSE 'MANTENIMIENTO'
                              END
            WHERE room_id = NEW.room_id;
        END IF;

    ELSIF TG_OP = 'UPDATE' AND OLD.actual_end_date IS NULL AND NEW.actual_end_date IS NOT NULL THEN
        /**
         * Se cerró el bloqueo. Antes de devolver la habitación a DISPONIBLE se
         * verifica que no quede otro bloqueo vigente abierto: si se termina la
         * limpieza pero sigue abierto un arreglo de plomería, la habitación
         * tiene que seguir fuera de venta.
         */
        SELECT maintenance_type INTO v_otro_vigente
        FROM Room_Maintenance
        WHERE room_id = NEW.room_id
          AND maintenance_id <> NEW.maintenance_id
          AND actual_end_date IS NULL
          AND start_date <= CURRENT_DATE
        ORDER BY start_date
        LIMIT 1;

        IF FOUND THEN
            UPDATE Room
            SET room_status = CASE v_otro_vigente.maintenance_type
                                  WHEN 'LIMPIEZA'          THEN 'LIMPIEZA'
                                  WHEN 'FUERA_DE_SERVICIO' THEN 'FUERA_DE_SERVICIO'
                                  ELSE 'MANTENIMIENTO'
                              END
            WHERE room_id = NEW.room_id;
        ELSE
            UPDATE Room
            SET room_status = 'DISPONIBLE'
            WHERE room_id = NEW.room_id
              AND room_status <> 'OCUPADA';
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 2. La limpieza no bloquea reservas
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_check_maintenance_vs_reservation()
RETURNS TRIGGER AS $$
DECLARE
    v_codigo VARCHAR(20);
BEGIN
    -- La limpieza es operativa y se resuelve en horas: no compite con reservas.
    IF NEW.maintenance_type = 'LIMPIEZA' THEN
        RETURN NEW;
    END IF;

    SELECT reservation_code INTO v_codigo
    FROM Reservation
    WHERE room_id = NEW.room_id
      AND reservation_status IN ('PENDIENTE', 'CONFIRMADA', 'IN_HOUSE')
      AND daterange(check_in_date, check_out_date, '[)')
          && daterange(NEW.start_date, COALESCE(NEW.actual_end_date, NEW.estimated_end_date), '[]')
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'La habitación tiene la reserva % en esas fechas. Reubicala antes de bloquearla.', v_codigo;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 3. Activación de bloqueos programados
-- =====================================================================

/**
 * Pone en su estado los bloqueos que empiezan hoy. Se ejecuta una vez por día,
 * en el mismo job que fn_process_no_shows():
 *
 *   SELECT fn_activate_scheduled_maintenance();
 *
 * Devuelve la cantidad de habitaciones afectadas.
 */
CREATE OR REPLACE FUNCTION fn_activate_scheduled_maintenance()
RETURNS INT AS $$
DECLARE
    v_afectadas INT;
BEGIN
    WITH activadas AS (
        UPDATE Room r
        SET room_status = CASE rm.maintenance_type
                              WHEN 'LIMPIEZA'          THEN 'LIMPIEZA'
                              WHEN 'FUERA_DE_SERVICIO' THEN 'FUERA_DE_SERVICIO'
                              ELSE 'MANTENIMIENTO'
                          END
        FROM Room_Maintenance rm
        WHERE rm.room_id = r.room_id
          AND rm.actual_end_date IS NULL
          AND rm.start_date <= CURRENT_DATE
          AND r.room_status = 'DISPONIBLE'
        RETURNING r.room_id
    )
    SELECT COUNT(*) INTO v_afectadas FROM activadas;

    RETURN v_afectadas;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 4. Vista de consulta de HU-9
-- =====================================================================

/**
 * Bloqueos con la habitación, el tipo y los responsables resueltos. Incluye
 * la duración real y si el cierre se atrasó respecto de lo estimado, que es
 * el dato que Gobernanza usa para saber qué trabajos se demoran.
 */
CREATE OR REPLACE VIEW v_room_maintenance_detail AS
SELECT
    rm.maintenance_id,
    rm.room_id,
    r.room_number,
    r.floor_number,
    rt.room_type_name,
    r.room_status,
    rm.maintenance_type,
    rm.start_date,
    rm.estimated_end_date,
    rm.actual_end_date,
    rm.reason,
    rm.closing_notes,
    (rm.actual_end_date IS NULL) AS is_open,
    (rm.actual_end_date IS NULL AND rm.start_date > CURRENT_DATE) AS is_scheduled,
    CASE
        WHEN rm.actual_end_date IS NULL AND rm.estimated_end_date < CURRENT_DATE THEN TRUE
        WHEN rm.actual_end_date > rm.estimated_end_date THEN TRUE
        ELSE FALSE
    END AS is_delayed,
    COALESCE(rm.actual_end_date, CURRENT_DATE) - rm.start_date AS days_elapsed,
    ea.employees_name || ' ' || ea.employees_lastname AS opened_by_name,
    ec.employees_name || ' ' || ec.employees_lastname AS closed_by_name,
    rm.creation_date
FROM Room_Maintenance rm
JOIN Room r       ON r.room_id = rm.room_id
JOIN Room_Type rt ON rt.room_type_id = r.room_type_id
JOIN Employees ea ON ea.employees_id = rm.opened_by
LEFT JOIN Employees ec ON ec.employees_id = rm.closed_by;

COMMIT;