/**
 * Migración desde el esquema viejo (con type_operation_enum) al nuevo.
 * Usar SOLO si ya tenés la base cargada con datos que no querés perder.
 * Si podés recrear la base desde cero, corré 01_schema.sql + 02_seed.sql.
 *
 *   psql -d sistema_hotelero_db -f database/03_migracion_desde_enum.sql
 *
 * Es idempotente: se puede correr más de una vez.
 */

BEGIN;

-- 1. Columnas nuevas del catálogo de artículos (STK-02)
ALTER TABLE Articles ADD COLUMN IF NOT EXISTS article_number        VARCHAR(50);
ALTER TABLE Articles ADD COLUMN IF NOT EXISTS article_compound_name VARCHAR(200);

-- 2. Tabla de tipos de movimiento
CREATE TABLE IF NOT EXISTS Movement_Type (
    movement_type_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    movement_type    VARCHAR(50)  NOT NULL UNIQUE,
    description      VARCHAR(255) NOT NULL,
    effect           VARCHAR(20)  NOT NULL,
    active           BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT ck_movement_type_effect CHECK (effect IN ('SUMA','RESTA','TRANSFERENCIA'))
);

INSERT INTO Movement_Type (movement_type, description, effect) VALUES
    ('INGRESO',         'Entrada de mercadería al stock',           'SUMA'),
    ('EGRESO',          'Salida de mercadería del stock',           'RESTA'),
    ('TRANSFERENCIA',   'Traslado de mercadería entre depósitos',   'TRANSFERENCIA'),
    ('CONSUMO',         'Consumo interno de insumos',               'RESTA'),
    ('AJUSTE_POSITIVO', 'Ajuste de inventario que suma stock',      'SUMA'),
    ('AJUSTE_NEGATIVO', 'Ajuste de inventario que descuenta stock', 'RESTA')
ON CONFLICT (movement_type) DO NOTHING;

-- 3. Reemplazar el enum por la FK en Stock_Movement
ALTER TABLE Stock_Movement ADD COLUMN IF NOT EXISTS movement_type_id INT;

UPDATE Stock_Movement sm
SET movement_type_id = mt.movement_type_id
FROM Movement_Type mt
WHERE mt.movement_type = sm.stock_movement_operation_type::TEXT
  AND sm.movement_type_id IS NULL;

-- Cualquier movimiento sin correspondencia queda como INGRESO para no perderlo.
UPDATE Stock_Movement
SET movement_type_id = (SELECT movement_type_id FROM Movement_Type WHERE movement_type = 'INGRESO')
WHERE movement_type_id IS NULL;

ALTER TABLE Stock_Movement ALTER COLUMN movement_type_id SET NOT NULL;

ALTER TABLE Stock_Movement DROP CONSTRAINT IF EXISTS fk_stock_movement_type;
ALTER TABLE Stock_Movement
    ADD CONSTRAINT fk_stock_movement_type
    FOREIGN KEY (movement_type_id) REFERENCES Movement_Type(movement_type_id);

ALTER TABLE Stock_Movement DROP COLUMN IF EXISTS stock_movement_operation_type;
DROP TYPE IF EXISTS type_operation_enum;

-- 4. Origen pasa a ser opcional y se corrige la semántica de los INGRESO
ALTER TABLE Stock_Movement ALTER COLUMN deposit_origin_id DROP NOT NULL;

UPDATE Stock_Movement sm
SET deposit_destination_id = sm.deposit_origin_id,
    deposit_origin_id      = NULL
FROM Movement_Type mt
WHERE mt.movement_type_id = sm.movement_type_id
  AND mt.effect = 'SUMA'
  AND sm.deposit_destination_id IS NULL;

-- 5. Índices que faltaban y limpieza del redundante
CREATE INDEX IF NOT EXISTS idx_movement_destination ON Stock_Movement(deposit_destination_id);
CREATE INDEX IF NOT EXISTS idx_movement_type        ON Stock_Movement(movement_type_id);
CREATE INDEX IF NOT EXISTS idx_movement_employees   ON Stock_Movement(employees_id);
CREATE INDEX IF NOT EXISTS idx_movement_supplier    ON Stock_Movement(supplier_id);
CREATE INDEX IF NOT EXISTS idx_detail_stock         ON Movement_Stock_Detail(stock_id);
CREATE INDEX IF NOT EXISTS idx_employees_rol        ON Employees(rol_id);
CREATE INDEX IF NOT EXISTS idx_stock_deposit        ON Articles_Deposit_Stock(deposit_id);
DROP INDEX IF EXISTS idx_stock_articles_deposit;

COMMIT;

-- 6. Triggers de coherencia entre el efecto del tipo y los depósitos
CREATE OR REPLACE FUNCTION fn_validate_movement_deposits()
RETURNS TRIGGER AS $$
DECLARE
    v_effect VARCHAR(20);
BEGIN
    SELECT effect INTO v_effect FROM Movement_Type WHERE movement_type_id = NEW.movement_type_id;

    IF v_effect = 'SUMA' AND NEW.deposit_destination_id IS NULL THEN
        RAISE EXCEPTION 'Un movimiento de efecto SUMA requiere depósito de destino.';
    END IF;
    IF v_effect = 'RESTA' AND NEW.deposit_origin_id IS NULL THEN
        RAISE EXCEPTION 'Un movimiento de efecto RESTA requiere depósito de origen.';
    END IF;
    IF v_effect = 'TRANSFERENCIA' THEN
        IF NEW.deposit_origin_id IS NULL OR NEW.deposit_destination_id IS NULL THEN
            RAISE EXCEPTION 'Una transferencia requiere depósito de origen y de destino.';
        END IF;
        IF NEW.deposit_origin_id = NEW.deposit_destination_id THEN
            RAISE EXCEPTION 'El depósito de origen y el de destino deben ser distintos.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_movement_deposits ON Stock_Movement;
CREATE TRIGGER tr_validate_movement_deposits
    BEFORE INSERT OR UPDATE ON Stock_Movement
    FOR EACH ROW EXECUTE FUNCTION fn_validate_movement_deposits();

CREATE OR REPLACE FUNCTION fn_check_deposit_active()
RETURNS TRIGGER AS $$
DECLARE
    v_name VARCHAR(100);
BEGIN
    SELECT deposit_name INTO v_name
    FROM Deposit
    WHERE deposit_id IN (NEW.deposit_origin_id, NEW.deposit_destination_id)
      AND deposit_state = FALSE
    LIMIT 1;

    IF v_name IS NOT NULL THEN
        RAISE EXCEPTION 'El depósito "%" está inactivo.', v_name;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_check_deposit_active ON Stock_Movement;
CREATE TRIGGER tr_check_deposit_active
    BEFORE INSERT ON Stock_Movement
    FOR EACH ROW EXECUTE FUNCTION fn_check_deposit_active();
