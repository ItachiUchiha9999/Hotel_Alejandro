-- Migracion incremental: conserva tarifas, periodos y reservas existentes.
BEGIN;
ALTER TABLE room_type_rate ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
CREATE TABLE IF NOT EXISTS room_type_rate_history (
  history_id SERIAL PRIMARY KEY,
  rate_id INT NOT NULL REFERENCES room_type_rate(rate_id),
  employees_id INT NOT NULL REFERENCES employees(employees_id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  before_data JSONB NOT NULL,
  after_data JSONB NOT NULL
);
CREATE OR REPLACE FUNCTION fn_audit_rate_change() RETURNS TRIGGER AS $$
BEGIN
  IF ROW(OLD.base_price, OLD.currency, OLD.season_name, OLD.reason, OLD.active)
     IS DISTINCT FROM ROW(NEW.base_price, NEW.currency, NEW.season_name, NEW.reason, NEW.active) THEN
    INSERT INTO room_type_rate_history(rate_id, employees_id, before_data, after_data)
    VALUES (NEW.rate_id, NEW.employees_id, to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS tr_audit_rate_change ON room_type_rate;
CREATE TRIGGER tr_audit_rate_change AFTER UPDATE ON room_type_rate
FOR EACH ROW EXECUTE FUNCTION fn_audit_rate_change();
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
        WHERE rr.active AND rr.room_type_id = rt.room_type_id AND rr.valid_from <= p_check_in
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


CREATE OR REPLACE VIEW v_room_type_panel AS
SELECT
    rt.room_type_id,
    rt.room_type_name,
    rt.description,
    rt.max_capacity,
    rt.bed_setup,
    rt.active,
    rate.base_price      AS current_price,
    rate.currency,
    rate.valid_from      AS price_valid_from,
    COUNT(r.room_id) FILTER (WHERE r.active)                             AS active_rooms,
    COUNT(r.room_id) FILTER (WHERE r.active AND r.room_status = 'DISPONIBLE') AS available_rooms,
    COUNT(r.room_id)                                                     AS total_rooms
FROM Room_Type rt
LEFT JOIN Room r ON r.room_type_id = rt.room_type_id
LEFT JOIN LATERAL (
    SELECT rr.base_price, rr.currency, rr.valid_from
    FROM Room_Type_Rate rr
    WHERE rr.room_type_id = rt.room_type_id
      AND rr.active AND rr.valid_from <= CURRENT_DATE
      AND (rr.valid_to IS NULL OR rr.valid_to > CURRENT_DATE)
    ORDER BY rr.valid_from DESC
    LIMIT 1
) rate ON TRUE
GROUP BY rt.room_type_id, rt.room_type_name, rt.description, rt.max_capacity,
         rt.bed_setup, rt.active, rate.base_price, rate.currency, rate.valid_from;


COMMIT;
