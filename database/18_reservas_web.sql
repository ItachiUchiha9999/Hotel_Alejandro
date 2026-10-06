-- ECO-02: reintentos del formulario y cola persistente de confirmaciones.
-- Migración incremental: no modifica reservas ni clientes existentes.
BEGIN;
CREATE TABLE IF NOT EXISTS reservation_web_request (
  request_id UUID PRIMARY KEY,
  payload_hash CHAR(64) NOT NULL,
  reservation_id INT NOT NULL UNIQUE REFERENCES reservation(reservation_id) ON DELETE CASCADE,
  confirmation JSONB NOT NULL,
  email_sent_at TIMESTAMPTZ,
  email_attempts INT NOT NULL DEFAULT 0,
  email_next_attempt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  email_locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_web_email_pending ON reservation_web_request(email_next_attempt)
  WHERE email_sent_at IS NULL;
COMMIT;
