-- Hora de llegada estimada elegida por el huésped en la reserva web.
-- Se informa al completar la reserva (franja horaria, ej. "14:00") y
-- ayuda a recepción a preparar el check-in. No afecta la disponibilidad.
BEGIN;

ALTER TABLE reservation ADD COLUMN IF NOT EXISTS arrival_time TIME;

COMMENT ON COLUMN reservation.arrival_time IS
  'Hora de llegada estimada informada por el huésped en la web (franja horaria en punto)';

COMMIT;
