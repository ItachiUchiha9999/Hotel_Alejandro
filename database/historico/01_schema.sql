/**
 * Hotel Alejandro I — Sistema de Gestión de Stock (SIGH)
 * Esquema completo. PostgreSQL 17.
 *
 * Ejecutar sobre una base vacía:
 *   createdb sistema_hotelero_db
 *   psql -d sistema_hotelero_db -f database/01_schema.sql
 *   psql -d sistema_hotelero_db -f database/02_seed.sql
 *
 * Si ya tenés la base con el esquema viejo (el del ENUM type_operation_enum),
 * usá database/03_migracion_desde_enum.sql en lugar de este archivo.
 *
 * CAMBIOS RESPECTO DE LA VERSIÓN ANTERIOR
 * ---------------------------------------
 * 1. Se elimina type_operation_enum. Los tipos de movimiento pasan a ser datos
 *    en la tabla Movement_Type, administrables desde la aplicación (STK-04).
 *    La dirección de cada tipo la define su columna `effect`.
 * 2. deposit_origin_id pasa a ser NULLABLE. Antes, un INGRESO de proveedor
 *    estaba obligado a guardar el depósito de DESTINO en la columna de ORIGEN,
 *    lo que rompía cualquier reporte por depósito.
 * 3. Se agregan article_number y article_compound_name, que el catálogo de
 *    artículos (STK-02) ya usaba en el frontend pero no existían en la base.
 */

BEGIN;

-- =====================================================================
-- 1. Seguridad y usuarios
-- =====================================================================
CREATE TABLE Roles (
    rol_id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rol_name        VARCHAR(50)  NOT NULL UNIQUE,
    rol_pass        TEXT         NOT NULL,
    rol_description VARCHAR(255),
    rol_state       BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE Employees (
    employees_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rol_id             INT          NOT NULL,
    employees_name     VARCHAR(100) NOT NULL,
    employees_lastname VARCHAR(100) NOT NULL,
    employees_email    VARCHAR(150) NOT NULL UNIQUE,
    employees_phone    VARCHAR(30)  NOT NULL,
    employees_state    BOOLEAN      NOT NULL DEFAULT TRUE,
    creation_date      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_employees_rol FOREIGN KEY (rol_id) REFERENCES Roles(rol_id)
);

CREATE INDEX idx_employees_rol ON Employees(rol_id);

-- =====================================================================
-- 2. Proveedores
-- =====================================================================
CREATE TABLE Suppliers (
    supplier_id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supplier_legal_name VARCHAR(150) NOT NULL,
    supplier_trade_name VARCHAR(150),
    supplier_cuit       VARCHAR(13)  NOT NULL UNIQUE,
    supplier_email      VARCHAR(150),
    supplier_phone      VARCHAR(30),
    supplier_address    VARCHAR(200),
    supplier_state      BOOLEAN      NOT NULL DEFAULT TRUE,
    creation_date       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- 3. Categorías y artículos (STK-02)
-- =====================================================================
CREATE TABLE Categories (
    category_id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_name        VARCHAR(100) NOT NULL UNIQUE,
    category_description VARCHAR(200),
    category_state       BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE Articles (
    article_id                INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id               INT           NOT NULL,
    article_code              VARCHAR(50)   NOT NULL UNIQUE,
    article_number            VARCHAR(50),
    article_name              VARCHAR(150)  NOT NULL,
    article_compound_name     VARCHAR(200),
    article_description       VARCHAR(255),
    article_unit_of_measure   VARCHAR(20)   NOT NULL DEFAULT 'UNIDAD',
    article_stock_min_general NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    article_state             BOOLEAN       NOT NULL DEFAULT TRUE,
    creation_date             TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_article_stock_min CHECK (article_stock_min_general >= 0),
    CONSTRAINT fk_article_categories FOREIGN KEY (category_id) REFERENCES Categories(category_id)
);

CREATE INDEX idx_articles_category ON Articles(category_id);

-- =====================================================================
-- 4. Depósitos y stock (STK-01, STK-03)
-- =====================================================================
CREATE TABLE Deposit (
    deposit_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    deposit_name     VARCHAR(100) NOT NULL UNIQUE,
    deposit_location VARCHAR(150),
    deposit_state    BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE Articles_Deposit_Stock (
    stock_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    article_id   INT           NOT NULL,
    deposit_id   INT           NOT NULL,
    stock_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    update_date  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_stock_no_negative CHECK (stock_amount >= 0),
    CONSTRAINT uq_article_deposit UNIQUE (article_id, deposit_id),
    CONSTRAINT fk_stock_article FOREIGN KEY (article_id) REFERENCES Articles(article_id),
    CONSTRAINT fk_stock_deposit FOREIGN KEY (deposit_id) REFERENCES Deposit(deposit_id)
);

-- Nota: uq_article_deposit ya crea el índice sobre (article_id, deposit_id).
CREATE INDEX idx_stock_deposit ON Articles_Deposit_Stock(deposit_id);

-- =====================================================================
-- 5. Tipos de movimiento (STK-04)
-- =====================================================================
CREATE TABLE Movement_Type (
    movement_type_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    movement_type    VARCHAR(50)  NOT NULL UNIQUE,
    description      VARCHAR(255) NOT NULL,
    effect           VARCHAR(20)  NOT NULL,
    active           BOOLEAN      NOT NULL DEFAULT TRUE,

    CONSTRAINT ck_movement_type_effect
        CHECK (effect IN ('SUMA', 'RESTA', 'TRANSFERENCIA'))
);

-- =====================================================================
-- 6. Movimientos de stock (STK-05)
-- =====================================================================
CREATE TABLE Stock_Movement (
    stock_movement_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    movement_type_id       INT NOT NULL,
    deposit_origin_id      INT,
    deposit_destination_id INT,
    employees_id           INT NOT NULL,
    supplier_id            INT,
    observations           VARCHAR(255),
    transaction_date       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_stock_movement_type
        FOREIGN KEY (movement_type_id) REFERENCES Movement_Type(movement_type_id),
    CONSTRAINT fk_stock_movement_origin
        FOREIGN KEY (deposit_origin_id) REFERENCES Deposit(deposit_id),
    CONSTRAINT fk_stock_movement_destination
        FOREIGN KEY (deposit_destination_id) REFERENCES Deposit(deposit_id),
    CONSTRAINT fk_movement_employees
        FOREIGN KEY (employees_id) REFERENCES Employees(employees_id),
    CONSTRAINT fk_movement_supplier
        FOREIGN KEY (supplier_id) REFERENCES Suppliers(supplier_id)
);

CREATE INDEX idx_movement_date        ON Stock_Movement(transaction_date);
CREATE INDEX idx_movement_origin      ON Stock_Movement(deposit_origin_id);
CREATE INDEX idx_movement_destination ON Stock_Movement(deposit_destination_id);
CREATE INDEX idx_movement_type        ON Stock_Movement(movement_type_id);
CREATE INDEX idx_movement_employees   ON Stock_Movement(employees_id);
CREATE INDEX idx_movement_supplier    ON Stock_Movement(supplier_id);

CREATE TABLE Movement_Stock_Detail (
    detail_id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stock_movement_id INT           NOT NULL,
    stock_id          INT           NOT NULL,
    amount            NUMERIC(12,2) NOT NULL,

    CONSTRAINT ck_detail_amount_positive CHECK (amount > 0),
    CONSTRAINT uq_movement_stock UNIQUE (stock_movement_id, stock_id),
    CONSTRAINT fk_detail_movement
        FOREIGN KEY (stock_movement_id) REFERENCES Stock_Movement(stock_movement_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_detail_stock
        FOREIGN KEY (stock_id) REFERENCES Articles_Deposit_Stock(stock_id)
);

CREATE INDEX idx_detail_stock ON Movement_Stock_Detail(stock_id);

-- =====================================================================
-- 7. Coherencia entre el efecto del tipo y los depósitos
--    No se puede resolver con un CHECK simple porque depende de otra tabla.
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_validate_movement_deposits()
RETURNS TRIGGER AS $$
DECLARE
    v_effect VARCHAR(20);
BEGIN
    SELECT effect INTO v_effect
    FROM Movement_Type
    WHERE movement_type_id = NEW.movement_type_id;

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

CREATE TRIGGER tr_validate_movement_deposits
    BEFORE INSERT OR UPDATE ON Stock_Movement
    FOR EACH ROW EXECUTE FUNCTION fn_validate_movement_deposits();

-- No se puede mover stock hacia o desde un depósito inactivo.
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

CREATE TRIGGER tr_check_deposit_active
    BEFORE INSERT ON Stock_Movement
    FOR EACH ROW EXECUTE FUNCTION fn_check_deposit_active();

COMMIT;
