-- Correcciones de disponibilidad, stock de minibar y trazabilidad de cobros.
BEGIN;

ALTER TABLE Room_Service_Catalog
    ADD COLUMN IF NOT EXISTS inventory_article_id INT REFERENCES Articles(article_id),
    ADD COLUMN IF NOT EXISTS inventory_deposit_id INT REFERENCES Deposit(deposit_id);

ALTER TABLE Room_Service_Charge
    ADD COLUMN IF NOT EXISTS payment_method_id INT REFERENCES Payment_Method(payment_method_id),
    ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);

-- La limpieza ordinaria se resuelve en el flujo de housekeeping y no bloquea
-- la reserva del día de salida/ingreso. Mantenimiento y fuera de servicio sí.
CREATE OR REPLACE FUNCTION fn_validate_reservation()
RETURNS TRIGGER AS $$
DECLARE
    v_room RECORD;
    v_capacidad SMALLINT;
    v_personas SMALLINT;
    v_bloqueo RECORD;
BEGIN
    SELECT r.room_number, r.active, r.room_status, rt.max_capacity, rt.room_type_name
    INTO v_room
    FROM Room r JOIN Room_Type rt ON rt.room_type_id = r.room_type_id
    WHERE r.room_id = NEW.room_id;

    IF NOT v_room.active THEN RAISE EXCEPTION 'La habitación % está dada de baja.', v_room.room_number; END IF;
    IF v_room.room_status = 'FUERA_DE_SERVICIO' THEN RAISE EXCEPTION 'La habitación % está fuera de servicio.', v_room.room_number; END IF;
    v_personas := NEW.adults + NEW.children;
    IF v_personas > v_room.max_capacity THEN
        RAISE EXCEPTION 'La habitación % (%) admite hasta % personas y se intentan alojar %.',
            v_room.room_number, v_room.room_type_name, v_room.max_capacity, v_personas;
    END IF;

    IF NEW.reservation_status IN ('PENDIENTE', 'CONFIRMADA', 'IN_HOUSE') THEN
        SELECT start_date, estimated_end_date, reason INTO v_bloqueo
        FROM Room_Maintenance
        WHERE room_id = NEW.room_id AND actual_end_date IS NULL
          AND maintenance_type <> 'LIMPIEZA'
          AND daterange(start_date, estimated_end_date, '[]')
              && daterange(NEW.check_in_date, NEW.check_out_date, '[)')
        LIMIT 1;
        IF FOUND THEN
            RAISE EXCEPTION 'La habitación % tiene un bloqueo del % al % (%).',
                v_room.room_number, v_bloqueo.start_date, v_bloqueo.estimated_end_date, v_bloqueo.reason;
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.reservation_status IN ('FINALIZADA', 'CANCELADA', 'NO_SHOW') THEN
        IF NEW.check_in_date <> OLD.check_in_date OR NEW.check_out_date <> OLD.check_out_date OR NEW.room_id <> OLD.room_id THEN
            RAISE EXCEPTION 'No se puede modificar una reserva en estado %.', OLD.reservation_status;
        END IF;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.reservation_status = 'IN_HOUSE' AND NEW.reservation_status = 'CANCELADA' THEN
        RAISE EXCEPTION 'No se puede cancelar una reserva con check-in realizado. Corresponde registrar el check-out.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_available_rooms(
    p_check_in DATE, p_check_out DATE, p_capacity SMALLINT DEFAULT 1
)
RETURNS TABLE (
    room_id INT, room_number VARCHAR(10), room_type_id INT, room_type_name VARCHAR(60),
    max_capacity SMALLINT, floor_number SMALLINT, price_per_night NUMERIC(14,2),
    nights INT, total_estimated NUMERIC(14,2)
) AS $$
BEGIN
    IF p_check_out <= p_check_in THEN RAISE EXCEPTION 'La fecha de salida tiene que ser posterior a la de ingreso.'; END IF;
    RETURN QUERY
    SELECT r.room_id, r.room_number, rt.room_type_id, rt.room_type_name, rt.max_capacity,
           r.floor_number, rate.base_price, (p_check_out - p_check_in)::INT AS nights,
           ((p_check_out - p_check_in) * rate.base_price)::NUMERIC(14,2) AS total_estimated
    FROM Room r
    JOIN Room_Type rt ON rt.room_type_id = r.room_type_id
    JOIN LATERAL (
        SELECT rr.base_price FROM Room_Type_Rate rr
        WHERE rr.room_type_id = rt.room_type_id AND rr.valid_from <= p_check_in
          AND (rr.valid_to IS NULL OR rr.valid_to > p_check_in)
        ORDER BY rr.valid_from DESC LIMIT 1
    ) rate ON TRUE
    WHERE r.active AND rt.active AND r.room_status <> 'FUERA_DE_SERVICIO'
      AND rt.max_capacity >= p_capacity
      AND NOT EXISTS (
          SELECT 1 FROM Reservation res
          WHERE res.room_id = r.room_id AND res.reservation_status IN ('PENDIENTE', 'CONFIRMADA', 'IN_HOUSE')
            AND (res.reservation_status <> 'PENDIENTE' OR res.pending_expires_at IS NULL OR res.pending_expires_at > CURRENT_TIMESTAMP)
            AND daterange(res.check_in_date, res.check_out_date, '[)') && daterange(p_check_in, p_check_out, '[)')
      )
      AND NOT EXISTS (
          SELECT 1 FROM Room_Maintenance rm
          WHERE rm.room_id = r.room_id AND rm.actual_end_date IS NULL
            AND rm.maintenance_type <> 'LIMPIEZA'
            AND daterange(rm.start_date, rm.estimated_end_date, '[]') && daterange(p_check_in, p_check_out, '[)')
      )
      AND NOT EXISTS (
          SELECT 1 FROM Room_Hold h
          WHERE h.room_id = r.room_id AND h.released = FALSE AND h.expires_at > CURRENT_TIMESTAMP
            AND daterange(h.check_in_date, h.check_out_date, '[)') && daterange(p_check_in, p_check_out, '[)')
      )
    ORDER BY rt.room_type_name, r.room_number;
END;
$$ LANGUAGE plpgsql;

COMMIT;
