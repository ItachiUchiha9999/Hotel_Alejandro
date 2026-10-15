-- Hora estimada de salida indicada por el huésped al reservar en la web.
BEGIN;

ALTER TABLE reservation ADD COLUMN IF NOT EXISTS estimated_departure_time TIME;

COMMENT ON COLUMN reservation.estimated_departure_time IS
  'Hora estimada de salida informada por el huésped en la web';

COMMIT;
