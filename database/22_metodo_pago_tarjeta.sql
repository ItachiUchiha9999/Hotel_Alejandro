-- Medio de pago con tarjeta. Se registra la referencia/autorización del POS;
-- nunca se almacenan números completos ni códigos de seguridad de tarjetas.
BEGIN;

INSERT INTO payment_method (payment_method, description, requires_reference)
VALUES ('TARJETA', 'Tarjeta de crédito o débito: requiere código de autorización', TRUE)
ON CONFLICT (payment_method) DO NOTHING;

COMMIT;
