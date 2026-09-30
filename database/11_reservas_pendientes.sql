-- Sprint 3: plazo para confirmar reservas pendientes.
-- Ejecutar una sola vez en bases creadas antes de agregar pending_expires_at.
ALTER TABLE Reservation
    ADD COLUMN IF NOT EXISTS pending_expires_at TIMESTAMPTZ;
