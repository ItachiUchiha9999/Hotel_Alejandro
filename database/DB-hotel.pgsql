/**
 * ==========================================================================
 * HOTEL ALEJANDRO I — Sistema de Gestión Integral (SIGH)
 * Base de datos completa. PostgreSQL 17.
 * ==========================================================================
 *
 * ÚNICO SCRIPT DE BASE DE DATOS DEL PROYECTO.
 *
 *   Sprint 1 — STK: stock e insumos
 *   Sprint 2 — PROV: proveedores, órdenes de compra, comprobantes y pagos
 *   Sprint 3 — HAB / TAR / RES: habitaciones, tarifas y reservas
 *
 * EJECUTAR
 *   psql -U postgres -d sistema_hotelero_db -f database/DB-hotel.pgsql
 *   cd backend && npx prisma generate
 *
 * NO CORRER `prisma db pull` CONTRA ESTA BASE. Ese comando sobrescribe
 * schema.prisma y pierde los nombres de relación que Prisma no puede inferir.
 * El schema.prisma del repo y este archivo se mantienen a mano, en espejo.
 *
 * NOTA SOBRE PRISMA: las columnas generadas (subtotal, nights, total_amount)
 * y las restricciones EXCLUDE no se declaran en schema.prisma, porque Prisma 5
 * no las soporta y `generate` fallaría. Siguen funcionando en la base: el
 * backend nunca escribe esas columnas, las lee.
 */

-- Sin esta línea, psql en Windows lee el archivo con la codificación regional
-- (WIN1252) y los acentos se guardan rotos ("DepÃ³sito").
SET client_encoding = 'UTF8';

/**
 * btree_gist permite combinar una igualdad (room_id) con un solapamiento de
 * rangos (daterange) dentro de una misma restricción EXCLUDE. Es lo que hace
 * imposible la sobreventa de una habitación a nivel motor, sin depender de
 * que la aplicación revise antes de insertar.
 */
CREATE EXTENSION IF NOT EXISTS btree_gist;

/**
 * ==========================================================================
 * LIMPIEZA PREVIA — permite re-ejecutar el script las veces que haga falta.
 * OJO: BORRA TODOS LOS DATOS. En producción van migraciones incrementales.
 * ==========================================================================
 */
-- Vistas
DROP VIEW IF EXISTS v_supplier_voucher_balance CASCADE;
DROP VIEW IF EXISTS v_supplier_account_balance CASCADE;
DROP VIEW IF EXISTS v_purchase_order_summary CASCADE;
DROP VIEW IF EXISTS v_supplier_detail CASCADE;
DROP VIEW IF EXISTS v_expense_summary CASCADE;
DROP VIEW IF EXISTS v_room_type_panel CASCADE;
DROP VIEW IF EXISTS v_reservation_detail CASCADE;
DROP VIEW IF EXISTS v_room_status_board CASCADE;
DROP VIEW IF EXISTS v_rate_history CASCADE;

-- Tablas (orden inverso al de creación)
DROP TABLE IF EXISTS Room_Maintenance CASCADE;
DROP TABLE IF EXISTS Reservation_Check_Out CASCADE;
DROP TABLE IF EXISTS Reservation_Check_In CASCADE;
DROP TABLE IF EXISTS Reservation_Change_Log CASCADE;
DROP TABLE IF EXISTS Reservation_Status_History CASCADE;
DROP TABLE IF EXISTS Reservation CASCADE;
DROP TABLE IF EXISTS Room_Hold CASCADE;
DROP TABLE IF EXISTS Cancellation_Policy CASCADE;
DROP TABLE IF EXISTS Guest CASCADE;
DROP TABLE IF EXISTS Room CASCADE;
DROP TABLE IF EXISTS Room_Type_Rate CASCADE;
DROP TABLE IF EXISTS Room_Type CASCADE;
DROP TABLE IF EXISTS Hotel_Parameter CASCADE;
DROP TABLE IF EXISTS Expense_Payment_Order CASCADE;
DROP TABLE IF EXISTS Expense_Voucher CASCADE;
DROP TABLE IF EXISTS Expense CASCADE;
DROP TABLE IF EXISTS Expense_Category CASCADE;
DROP TABLE IF EXISTS Supplier_Account_Movement CASCADE;
DROP TABLE IF EXISTS Payment_Order_Reset CASCADE;
DROP TABLE IF EXISTS Payment_Order_Detail CASCADE;
DROP TABLE IF EXISTS Payment_Order CASCADE;
DROP TABLE IF EXISTS Payment_Method CASCADE;
DROP TABLE IF EXISTS Supplier_Voucher CASCADE;
DROP TABLE IF EXISTS Purchase_Order_Status_History CASCADE;
DROP TABLE IF EXISTS Purchase_Order_Detail CASCADE;
DROP TABLE IF EXISTS Purchase_Order CASCADE;
DROP TABLE IF EXISTS Voucher_Type CASCADE;
DROP TABLE IF EXISTS Movement_Stock_Detail CASCADE;
DROP TABLE IF EXISTS Stock_Movement CASCADE;
DROP TABLE IF EXISTS Movement_Type CASCADE;
DROP TABLE IF EXISTS Articles_Deposit_Stock CASCADE;
DROP TABLE IF EXISTS Deposit CASCADE;
DROP TABLE IF EXISTS Articles CASCADE;
DROP TABLE IF EXISTS Categories CASCADE;
DROP TABLE IF EXISTS Suppliers CASCADE;
DROP TABLE IF EXISTS Tax_Condition CASCADE;
DROP TABLE IF EXISTS Employees CASCADE;
DROP TABLE IF EXISTS Roles CASCADE;

-- Funciones y secuencias
DROP FUNCTION IF EXISTS fn_validate_movement_deposits() CASCADE;
DROP FUNCTION IF EXISTS fn_check_deposit_active() CASCADE;
DROP FUNCTION IF EXISTS fn_sync_voucher_status() CASCADE;
DROP FUNCTION IF EXISTS fn_check_voucher_annul() CASCADE;
DROP FUNCTION IF EXISTS fn_validate_payment_detail() CASCADE;
DROP FUNCTION IF EXISTS fn_sync_payment_order_total() CASCADE;
DROP FUNCTION IF EXISTS fn_check_payment_reference() CASCADE;
DROP FUNCTION IF EXISTS fn_sync_purchase_order_total() CASCADE;
DROP FUNCTION IF EXISTS fn_check_expense_allocation() CASCADE;
DROP FUNCTION IF EXISTS fn_room_type_no_delete() CASCADE;
DROP FUNCTION IF EXISTS fn_check_room_type_active() CASCADE;
DROP FUNCTION IF EXISTS fn_close_previous_rate() CASCADE;
DROP FUNCTION IF EXISTS fn_generate_reservation_code() CASCADE;
DROP FUNCTION IF EXISTS fn_validate_reservation() CASCADE;
DROP FUNCTION IF EXISTS fn_log_reservation_status() CASCADE;
DROP FUNCTION IF EXISTS fn_log_reservation_changes() CASCADE;
DROP FUNCTION IF EXISTS fn_process_check_in() CASCADE;
DROP FUNCTION IF EXISTS fn_process_check_out() CASCADE;
DROP FUNCTION IF EXISTS fn_sync_room_maintenance() CASCADE;
DROP FUNCTION IF EXISTS fn_check_maintenance_vs_reservation() CASCADE;
DROP FUNCTION IF EXISTS fn_available_rooms() CASCADE;
DROP FUNCTION IF EXISTS fn_process_no_shows() CASCADE;
DROP FUNCTION IF EXISTS fn_release_expired_holds() CASCADE;
DROP FUNCTION IF EXISTS fn_available_rooms(DATE, DATE, SMALLINT) CASCADE;
DROP SEQUENCE IF EXISTS seq_reservation_code CASCADE;

-- Tipo del esquema V1.0, si quedó de una instalación anterior
DROP TYPE IF EXISTS type_operation_enum CASCADE;

BEGIN;

-- ##########################################################################
-- SPRINT 1 — Stock e insumos (STK-01 a STK-05)
-- ##########################################################################

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
-- 2. Proveedores y condición fiscal (PROV-01)
-- =====================================================================

CREATE TABLE Tax_Condition (
    tax_condition_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tax_condition_name VARCHAR(60)  NOT NULL UNIQUE,
    description        VARCHAR(200),
    active             BOOLEAN      NOT NULL DEFAULT TRUE
);

-- =====================================================================
-- 2b. Proveedores
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
    tax_condition_id    INT,
    creation_date       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- PROV-01: 11 dígitos, con o sin guiones. El dígito verificador se valida
    -- en el backend, porque el CHECK quedaría ilegible.
    CONSTRAINT ck_supplier_cuit_format
        CHECK (supplier_cuit ~ '^[0-9]{2}-?[0-9]{8}-?[0-9]{1}$'),
    CONSTRAINT fk_supplier_tax_condition
        FOREIGN KEY (tax_condition_id) REFERENCES Tax_Condition(tax_condition_id)
);

CREATE INDEX idx_supplier_tax_condition ON Suppliers(tax_condition_id);

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

-- ##########################################################################
-- SPRINT 2 — Comprobantes y órdenes de pago (PROV-01 a PROV-07)
-- ##########################################################################

-- =====================================================================
-- 1. Catálogo de tipos de comprobante (PROV-03)
-- =====================================================================

/**
 * `sign` es la pieza central del diseño, igual que `effect` en Movement_Type:
 * define si el comprobante AUMENTA la deuda con el proveedor (+1: factura,
 * nota de débito) o la DISMINUYE (-1: nota de crédito).
 */
CREATE TABLE Voucher_Type (
    voucher_type_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    voucher_type      VARCHAR(50)  NOT NULL UNIQUE,
    description       VARCHAR(255) NOT NULL,
    sign              SMALLINT     NOT NULL,
    affects_account   BOOLEAN      NOT NULL DEFAULT TRUE,
    is_payable        BOOLEAN      NOT NULL DEFAULT TRUE,
    active            BOOLEAN      NOT NULL DEFAULT TRUE,

    CONSTRAINT ck_voucher_type_sign CHECK (sign IN (-1, 1))
);

-- =====================================================================
-- 2. Órdenes de compra (PROV-02)
-- =====================================================================
CREATE TABLE Purchase_Order (
    purchase_order_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    purchase_order_number VARCHAR(20)   NOT NULL UNIQUE,
    supplier_id           INT           NOT NULL,
    issue_date            DATE          NOT NULL,
    expected_date         DATE,
    purchase_conditions   VARCHAR(255),
    purchase_order_status VARCHAR(20)   NOT NULL DEFAULT 'BORRADOR',
    total_amount          NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    observations          VARCHAR(255),
    employees_id          INT           NOT NULL,
    creation_date         TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_purchase_order_status
        CHECK (purchase_order_status IN ('BORRADOR', 'EMITIDA', 'APROBADA', 'RECIBIDA', 'CANCELADA')),
    CONSTRAINT ck_purchase_order_total CHECK (total_amount >= 0),
    CONSTRAINT ck_purchase_order_dates CHECK (expected_date IS NULL OR expected_date >= issue_date),

    CONSTRAINT fk_purchase_order_supplier FOREIGN KEY (supplier_id)  REFERENCES Suppliers(supplier_id),
    CONSTRAINT fk_purchase_order_employee FOREIGN KEY (employees_id) REFERENCES Employees(employees_id)
);

CREATE INDEX idx_purchase_order_supplier ON Purchase_Order(supplier_id);
CREATE INDEX idx_purchase_order_status   ON Purchase_Order(purchase_order_status);
CREATE INDEX idx_purchase_order_date     ON Purchase_Order(issue_date);
CREATE INDEX idx_purchase_order_employee ON Purchase_Order(employees_id);

CREATE TABLE Purchase_Order_Detail (
    purchase_detail_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    purchase_order_id  INT           NOT NULL,
    article_id         INT,
    item_description   VARCHAR(255)  NOT NULL,
    quantity           NUMERIC(12,2) NOT NULL,
    unit_price         NUMERIC(14,2) NOT NULL,
    subtotal           NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

    CONSTRAINT ck_purchase_detail_quantity CHECK (quantity > 0),
    CONSTRAINT ck_purchase_detail_price    CHECK (unit_price >= 0),

    CONSTRAINT fk_purchase_detail_order
        FOREIGN KEY (purchase_order_id) REFERENCES Purchase_Order(purchase_order_id) ON DELETE CASCADE,
    CONSTRAINT fk_purchase_detail_article
        FOREIGN KEY (article_id) REFERENCES Articles(article_id)
);

CREATE INDEX idx_purchase_detail_order   ON Purchase_Order_Detail(purchase_order_id);
CREATE INDEX idx_purchase_detail_article ON Purchase_Order_Detail(article_id);

CREATE TABLE Purchase_Order_Status_History (
    status_history_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    purchase_order_id INT          NOT NULL,
    previous_status   VARCHAR(20),
    new_status        VARCHAR(20)  NOT NULL,
    changed_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    employees_id      INT          NOT NULL,
    reason            VARCHAR(255),

    CONSTRAINT fk_status_history_order
        FOREIGN KEY (purchase_order_id) REFERENCES Purchase_Order(purchase_order_id) ON DELETE CASCADE,
    CONSTRAINT fk_status_history_employee
        FOREIGN KEY (employees_id) REFERENCES Employees(employees_id)
);

CREATE INDEX idx_status_history_order ON Purchase_Order_Status_History(purchase_order_id);

-- =====================================================================
-- 3. Comprobantes de proveedores (PROV-04, PROV-05)
-- =====================================================================
CREATE TABLE Supplier_Voucher (
    voucher_id             INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supplier_id            INT           NOT NULL,
    voucher_type_id        INT           NOT NULL,
    voucher_point_of_sale  VARCHAR(5)    NOT NULL DEFAULT '0001',
    voucher_number         VARCHAR(20)   NOT NULL,
    issue_date             DATE          NOT NULL,
    due_date               DATE,
    reception_date         TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount           NUMERIC(14,2) NOT NULL,
    paid_amount            NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    voucher_status         VARCHAR(20)   NOT NULL DEFAULT 'PENDIENTE',
    observations           VARCHAR(255),
    employees_id           INT           NOT NULL,
    creation_date          TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    purchase_order_id      INT,
    annulled_date          TIMESTAMPTZ,
    annulled_reason        VARCHAR(255),

    CONSTRAINT ck_voucher_total_positive CHECK (total_amount > 0),
    CONSTRAINT ck_voucher_paid_range     CHECK (paid_amount >= 0 AND paid_amount <= total_amount),
    CONSTRAINT ck_voucher_status         CHECK (voucher_status IN ('PENDIENTE', 'PAGADO', 'ANULADO')),
    CONSTRAINT ck_voucher_due_date       CHECK (due_date IS NULL OR due_date >= issue_date),

    CONSTRAINT uq_voucher_supplier_number
        UNIQUE (supplier_id, voucher_type_id, voucher_point_of_sale, voucher_number),

    CONSTRAINT fk_voucher_supplier  FOREIGN KEY (supplier_id)     REFERENCES Suppliers(supplier_id),
    CONSTRAINT fk_voucher_type      FOREIGN KEY (voucher_type_id) REFERENCES Voucher_Type(voucher_type_id),
    CONSTRAINT fk_voucher_employees FOREIGN KEY (employees_id)    REFERENCES Employees(employees_id),
    CONSTRAINT fk_voucher_purchase_order FOREIGN KEY (purchase_order_id) REFERENCES Purchase_Order(purchase_order_id)
);

CREATE INDEX idx_voucher_supplier       ON Supplier_Voucher(supplier_id);
CREATE INDEX idx_voucher_purchase_order ON Supplier_Voucher(purchase_order_id);
CREATE INDEX idx_voucher_type           ON Supplier_Voucher(voucher_type_id);
CREATE INDEX idx_voucher_status         ON Supplier_Voucher(voucher_status);
CREATE INDEX idx_voucher_issue_date     ON Supplier_Voucher(issue_date);
CREATE INDEX idx_voucher_employees      ON Supplier_Voucher(employees_id);

CREATE INDEX idx_voucher_pendientes
    ON Supplier_Voucher(supplier_id, issue_date)
    WHERE voucher_status = 'PENDIENTE';

-- =====================================================================
-- 4. Formas de pago (PROV-07)
-- =====================================================================
CREATE TABLE Payment_Method (
    payment_method_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payment_method     VARCHAR(50)  NOT NULL UNIQUE,
    description        VARCHAR(255) NOT NULL,
    requires_reference BOOLEAN      NOT NULL DEFAULT FALSE,
    active             BOOLEAN      NOT NULL DEFAULT TRUE
);

-- =====================================================================
-- 5. Órdenes de pago (PROV-06)
-- =====================================================================
CREATE TABLE Payment_Order (
    payment_order_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supplier_id          INT           NOT NULL,
    payment_method_id    INT           NOT NULL,
    payment_date         DATE          NOT NULL,
    total_amount         NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    payment_reference    VARCHAR(100),
    payment_order_status SMALLINT      NOT NULL DEFAULT 0,
    observations         VARCHAR(255),
    employees_id         INT           NOT NULL,
    creation_date        TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_date       TIMESTAMPTZ,

    CONSTRAINT ck_payment_order_status CHECK (payment_order_status IN (0, 1, 2)),
    CONSTRAINT ck_payment_order_total  CHECK (total_amount >= 0),

    CONSTRAINT fk_payment_order_supplier FOREIGN KEY (supplier_id)       REFERENCES Suppliers(supplier_id),
    CONSTRAINT fk_payment_order_method   FOREIGN KEY (payment_method_id) REFERENCES Payment_Method(payment_method_id),
    CONSTRAINT fk_payment_order_employee FOREIGN KEY (employees_id)      REFERENCES Employees(employees_id)
);

CREATE INDEX idx_payment_order_supplier ON Payment_Order(supplier_id);
CREATE INDEX idx_payment_order_date     ON Payment_Order(payment_date);
CREATE INDEX idx_payment_order_status   ON Payment_Order(payment_order_status);
CREATE INDEX idx_payment_order_method   ON Payment_Order(payment_method_id);

CREATE TABLE Payment_Order_Detail (
    detail_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payment_order_id INT           NOT NULL,
    voucher_id       INT           NOT NULL,
    applied_amount   NUMERIC(14,2) NOT NULL,

    CONSTRAINT ck_applied_amount_positive CHECK (applied_amount > 0),
    CONSTRAINT uq_payment_order_voucher   UNIQUE (payment_order_id, voucher_id),

    CONSTRAINT fk_detail_payment_order
        FOREIGN KEY (payment_order_id) REFERENCES Payment_Order(payment_order_id) ON DELETE CASCADE,
    CONSTRAINT fk_detail_voucher
        FOREIGN KEY (voucher_id) REFERENCES Supplier_Voucher(voucher_id)
);

CREATE INDEX idx_payment_detail_voucher ON Payment_Order_Detail(voucher_id);

CREATE TABLE Payment_Order_Reset (
    reset_id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payment_order_id INT           NOT NULL,
    employees_id     INT           NOT NULL,
    reset_date       TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    restored_amount  NUMERIC(14,2) NOT NULL,
    reset_reason     VARCHAR(255)  NOT NULL,

    CONSTRAINT fk_reset_payment_order FOREIGN KEY (payment_order_id) REFERENCES Payment_Order(payment_order_id),
    CONSTRAINT fk_reset_employee      FOREIGN KEY (employees_id)     REFERENCES Employees(employees_id)
);

CREATE INDEX idx_reset_payment_order ON Payment_Order_Reset(payment_order_id);

-- =====================================================================
-- 6. Cuenta corriente de proveedores (PROV-07)
-- =====================================================================

/**
 * Libro mayor de cada proveedor. Es APPEND-ONLY: las filas no se editan ni se
 * borran nunca. El saldo NO se guarda como columna: se calcula sumando debe y
 * haber, de modo que no puede desincronizarse.
 */
CREATE TABLE Supplier_Account_Movement (
    account_movement_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supplier_id             INT           NOT NULL,
    movement_date           TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    concept                 VARCHAR(150)  NOT NULL,
    debit                   NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    credit                  NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    voucher_id              INT,
    payment_order_id        INT,
    reversal_of_movement_id INT,
    employees_id            INT           NOT NULL,
    creation_date           TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_account_amounts_positive CHECK (debit >= 0 AND credit >= 0),
    CONSTRAINT ck_account_single_side
        CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)),
    CONSTRAINT ck_account_has_origin
        CHECK (voucher_id IS NOT NULL OR payment_order_id IS NOT NULL OR reversal_of_movement_id IS NOT NULL),

    CONSTRAINT fk_account_supplier      FOREIGN KEY (supplier_id)      REFERENCES Suppliers(supplier_id),
    CONSTRAINT fk_account_voucher       FOREIGN KEY (voucher_id)       REFERENCES Supplier_Voucher(voucher_id),
    CONSTRAINT fk_account_payment_order FOREIGN KEY (payment_order_id) REFERENCES Payment_Order(payment_order_id),
    CONSTRAINT fk_account_reversal      FOREIGN KEY (reversal_of_movement_id) REFERENCES Supplier_Account_Movement(account_movement_id),
    CONSTRAINT fk_account_employee      FOREIGN KEY (employees_id)     REFERENCES Employees(employees_id)
);

CREATE INDEX idx_account_supplier      ON Supplier_Account_Movement(supplier_id, movement_date);
CREATE INDEX idx_account_voucher       ON Supplier_Account_Movement(voucher_id);
CREATE INDEX idx_account_payment_order ON Supplier_Account_Movement(payment_order_id);

-- =====================================================================
-- 7. Reglas de negocio del módulo PROV
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_sync_voucher_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.annulled_date IS NOT NULL THEN
        NEW.voucher_status := 'ANULADO';
    ELSIF NEW.paid_amount >= NEW.total_amount THEN
        NEW.voucher_status := 'PAGADO';
    ELSE
        NEW.voucher_status := 'PENDIENTE';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sync_voucher_status
    BEFORE INSERT OR UPDATE ON Supplier_Voucher
    FOR EACH ROW EXECUTE FUNCTION fn_sync_voucher_status();

CREATE OR REPLACE FUNCTION fn_check_voucher_annul()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.annulled_date IS NOT NULL
       AND OLD.annulled_date IS NULL
       AND NEW.paid_amount > 0 THEN
        RAISE EXCEPTION 'No se puede anular un comprobante con pagos aplicados. Reseteá primero las órdenes de pago que lo afectan.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_check_voucher_annul
    BEFORE UPDATE ON Supplier_Voucher
    FOR EACH ROW EXECUTE FUNCTION fn_check_voucher_annul();

CREATE OR REPLACE FUNCTION fn_validate_payment_detail()
RETURNS TRIGGER AS $$
DECLARE
    v_order    RECORD;
    v_voucher  RECORD;
    v_pending  NUMERIC(14,2);
    v_previous NUMERIC(14,2);
BEGIN
    SELECT * INTO v_order FROM Payment_Order WHERE payment_order_id = NEW.payment_order_id;

    IF v_order.payment_order_status <> 0 THEN
        RAISE EXCEPTION 'Solo se pueden modificar los comprobantes de una orden en borrador.';
    END IF;

    SELECT sv.*, vt.is_payable INTO v_voucher
    FROM Supplier_Voucher sv
    JOIN Voucher_Type vt ON vt.voucher_type_id = sv.voucher_type_id
    WHERE sv.voucher_id = NEW.voucher_id;

    IF v_voucher.supplier_id <> v_order.supplier_id THEN
        RAISE EXCEPTION 'El comprobante pertenece a otro proveedor. Una orden de pago solo puede incluir comprobantes de un mismo proveedor.';
    END IF;

    IF v_voucher.voucher_status = 'ANULADO' THEN
        RAISE EXCEPTION 'El comprobante está anulado y no se puede pagar.';
    END IF;

    IF NOT v_voucher.is_payable THEN
        RAISE EXCEPTION 'El tipo de comprobante no admite órdenes de pago.';
    END IF;

    v_previous := COALESCE((SELECT applied_amount FROM Payment_Order_Detail WHERE detail_id = NEW.detail_id), 0);
    v_pending  := v_voucher.total_amount - v_voucher.paid_amount + v_previous;

    IF NEW.applied_amount > v_pending THEN
        RAISE EXCEPTION 'El importe aplicado (%) supera el saldo pendiente del comprobante (%).',
            NEW.applied_amount, v_pending;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_validate_payment_detail
    BEFORE INSERT OR UPDATE ON Payment_Order_Detail
    FOR EACH ROW EXECUTE FUNCTION fn_validate_payment_detail();

CREATE OR REPLACE FUNCTION fn_sync_payment_order_total()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id INT;
BEGIN
    v_order_id := COALESCE(NEW.payment_order_id, OLD.payment_order_id);

    UPDATE Payment_Order
    SET total_amount = COALESCE(
        (SELECT SUM(applied_amount) FROM Payment_Order_Detail WHERE payment_order_id = v_order_id), 0)
    WHERE payment_order_id = v_order_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sync_payment_order_total
    AFTER INSERT OR UPDATE OR DELETE ON Payment_Order_Detail
    FOR EACH ROW EXECUTE FUNCTION fn_sync_payment_order_total();

CREATE OR REPLACE FUNCTION fn_check_payment_reference()
RETURNS TRIGGER AS $$
DECLARE
    v_requires BOOLEAN;
    v_method   VARCHAR(50);
BEGIN
    IF NEW.payment_order_status <> 1 THEN
        RETURN NEW;
    END IF;

    SELECT requires_reference, payment_method INTO v_requires, v_method
    FROM Payment_Method WHERE payment_method_id = NEW.payment_method_id;

    IF v_requires AND (NEW.payment_reference IS NULL OR TRIM(NEW.payment_reference) = '') THEN
        RAISE EXCEPTION 'La forma de pago % requiere una referencia (número de cheque o de transferencia).', v_method;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_check_payment_reference
    BEFORE INSERT OR UPDATE ON Payment_Order
    FOR EACH ROW EXECUTE FUNCTION fn_check_payment_reference();

-- Mantiene el total de la orden de compra igual a la suma de sus renglones.
CREATE OR REPLACE FUNCTION fn_sync_purchase_order_total()
RETURNS TRIGGER AS $$
DECLARE
    v_purchase_order_id INT;
BEGIN
    v_purchase_order_id := COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);

    UPDATE Purchase_Order
    SET total_amount = COALESCE(
        (
            SELECT SUM(quantity * unit_price)
            FROM Purchase_Order_Detail
            WHERE purchase_order_id = v_purchase_order_id
        ),
        0
    )
    WHERE purchase_order_id = v_purchase_order_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sync_purchase_order_total
    AFTER INSERT OR UPDATE OR DELETE ON Purchase_Order_Detail
    FOR EACH ROW EXECUTE FUNCTION fn_sync_purchase_order_total();

-- =====================================================================
-- 8. Vistas del módulo PROV
-- =====================================================================

CREATE OR REPLACE VIEW v_supplier_voucher_balance AS
SELECT
    sv.voucher_id,
    sv.supplier_id,
    s.supplier_legal_name,
    s.supplier_trade_name,
    vt.voucher_type,
    vt.sign,
    sv.voucher_point_of_sale || '-' || sv.voucher_number AS voucher_full_number,
    sv.issue_date,
    sv.due_date,
    sv.total_amount,
    sv.paid_amount,
    sv.total_amount - sv.paid_amount AS pending_amount,
    sv.voucher_status,
    CASE
        WHEN sv.voucher_status = 'PENDIENTE' AND sv.due_date < CURRENT_DATE THEN TRUE
        ELSE FALSE
    END AS is_overdue
FROM Supplier_Voucher sv
JOIN Suppliers s     ON s.supplier_id = sv.supplier_id
JOIN Voucher_Type vt ON vt.voucher_type_id = sv.voucher_type_id;

CREATE OR REPLACE VIEW v_supplier_account_balance AS
SELECT
    s.supplier_id,
    s.supplier_legal_name,
    s.supplier_trade_name,
    s.supplier_cuit,
    COALESCE(SUM(sam.debit), 0)  AS total_debit,
    COALESCE(SUM(sam.credit), 0) AS total_credit,
    COALESCE(SUM(sam.debit), 0) - COALESCE(SUM(sam.credit), 0) AS current_balance,
    MAX(sam.movement_date) AS last_movement_date
FROM Suppliers s
LEFT JOIN Supplier_Account_Movement sam ON sam.supplier_id = s.supplier_id
GROUP BY s.supplier_id, s.supplier_legal_name, s.supplier_trade_name, s.supplier_cuit;

CREATE OR REPLACE VIEW v_purchase_order_summary AS
SELECT
    po.purchase_order_id,
    po.purchase_order_number,
    po.supplier_id,
    s.supplier_legal_name,
    s.supplier_trade_name,
    po.issue_date,
    po.expected_date,
    po.purchase_order_status,
    po.purchase_conditions,
    po.total_amount,
    COUNT(pod.purchase_detail_id) AS item_count,
    COUNT(DISTINCT sv.voucher_id) AS voucher_count,
    CASE
        WHEN po.purchase_order_status IN ('EMITIDA', 'APROBADA')
             AND po.expected_date < CURRENT_DATE THEN TRUE
        ELSE FALSE
    END AS is_overdue
FROM Purchase_Order po
JOIN Suppliers s ON s.supplier_id = po.supplier_id
LEFT JOIN Purchase_Order_Detail pod ON pod.purchase_order_id = po.purchase_order_id
LEFT JOIN Supplier_Voucher sv       ON sv.purchase_order_id = po.purchase_order_id
GROUP BY po.purchase_order_id, po.purchase_order_number, po.supplier_id,
         s.supplier_legal_name, s.supplier_trade_name, po.issue_date,
         po.expected_date, po.purchase_order_status, po.purchase_conditions,
         po.total_amount;

CREATE OR REPLACE VIEW v_supplier_detail AS
SELECT
    s.supplier_id,
    s.supplier_legal_name,
    s.supplier_trade_name,
    s.supplier_cuit,
    s.supplier_email,
    s.supplier_phone,
    s.supplier_address,
    s.supplier_state,
    s.creation_date,
    s.tax_condition_id,
    tc.tax_condition_name
FROM Suppliers s
LEFT JOIN Tax_Condition tc ON tc.tax_condition_id = s.tax_condition_id;

-- ##########################################################################
-- SPRINT 2 — Control de gastos (PROV-08, fuera del alcance comprometido)
-- ##########################################################################

CREATE TABLE Expense_Category (
    expense_category_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    expense_category_name VARCHAR(100) NOT NULL UNIQUE,
    description           VARCHAR(255),
    active                BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE Expense (
    expense_id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    expense_category_id INT          NOT NULL,
    supplier_id         INT,
    expense_date        DATE         NOT NULL,
    description         VARCHAR(255) NOT NULL,
    expense_status      VARCHAR(20)  NOT NULL DEFAULT 'REGISTRADO',
    employees_id        INT          NOT NULL,
    creation_date       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_expense_status CHECK (expense_status IN ('REGISTRADO', 'IMPUTADO', 'ANULADO')),

    CONSTRAINT fk_expense_category FOREIGN KEY (expense_category_id) REFERENCES Expense_Category(expense_category_id),
    CONSTRAINT fk_expense_supplier FOREIGN KEY (supplier_id)         REFERENCES Suppliers(supplier_id),
    CONSTRAINT fk_expense_employee FOREIGN KEY (employees_id)        REFERENCES Employees(employees_id)
);

CREATE INDEX idx_expense_category ON Expense(expense_category_id);
CREATE INDEX idx_expense_supplier ON Expense(supplier_id);
CREATE INDEX idx_expense_date     ON Expense(expense_date);

CREATE TABLE Expense_Voucher (
    expense_voucher_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    expense_id         INT           NOT NULL,
    voucher_id         INT           NOT NULL,
    allocated_amount   NUMERIC(14,2) NOT NULL,

    CONSTRAINT ck_allocated_positive CHECK (allocated_amount > 0),
    CONSTRAINT uq_expense_voucher    UNIQUE (expense_id, voucher_id),

    CONSTRAINT fk_expense_voucher_expense FOREIGN KEY (expense_id) REFERENCES Expense(expense_id) ON DELETE CASCADE,
    CONSTRAINT fk_expense_voucher_voucher FOREIGN KEY (voucher_id) REFERENCES Supplier_Voucher(voucher_id)
);

CREATE INDEX idx_expense_voucher_voucher ON Expense_Voucher(voucher_id);

CREATE TABLE Expense_Payment_Order (
    expense_payment_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    expense_id         INT NOT NULL,
    payment_order_id   INT NOT NULL,

    CONSTRAINT uq_expense_payment_order UNIQUE (expense_id, payment_order_id),

    CONSTRAINT fk_expense_payment_expense FOREIGN KEY (expense_id)       REFERENCES Expense(expense_id) ON DELETE CASCADE,
    CONSTRAINT fk_expense_payment_order   FOREIGN KEY (payment_order_id) REFERENCES Payment_Order(payment_order_id)
);

CREATE INDEX idx_expense_payment_order ON Expense_Payment_Order(payment_order_id);

CREATE OR REPLACE FUNCTION fn_check_expense_allocation()
RETURNS TRIGGER AS $$
DECLARE
    v_total     NUMERIC(14,2);
    v_allocated NUMERIC(14,2);
BEGIN
    SELECT total_amount INTO v_total FROM Supplier_Voucher WHERE voucher_id = NEW.voucher_id;

    SELECT COALESCE(SUM(allocated_amount), 0) INTO v_allocated
    FROM Expense_Voucher
    WHERE voucher_id = NEW.voucher_id
      AND expense_voucher_id <> COALESCE(NEW.expense_voucher_id, 0);

    IF v_allocated + NEW.allocated_amount > v_total THEN
        RAISE EXCEPTION 'La imputación total (%) supera el importe del comprobante (%).',
            v_allocated + NEW.allocated_amount, v_total;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_check_expense_allocation
    BEFORE INSERT OR UPDATE ON Expense_Voucher
    FOR EACH ROW EXECUTE FUNCTION fn_check_expense_allocation();

CREATE OR REPLACE VIEW v_expense_summary AS
SELECT
    e.expense_id,
    e.expense_date,
    e.description,
    e.expense_status,
    ec.expense_category_name,
    s.supplier_legal_name,
    COALESCE(SUM(ev.allocated_amount), 0) AS expense_amount,
    COUNT(DISTINCT ev.voucher_id)         AS voucher_count
FROM Expense e
JOIN Expense_Category ec     ON ec.expense_category_id = e.expense_category_id
LEFT JOIN Suppliers s        ON s.supplier_id = e.supplier_id
LEFT JOIN Expense_Voucher ev ON ev.expense_id = e.expense_id
GROUP BY e.expense_id, e.expense_date, e.description, e.expense_status,
         ec.expense_category_name, s.supplier_legal_name;


-- ##########################################################################
-- SPRINT 3 — Reservas y Gestión de Habitaciones (HAB / TAR / RES)
-- ##########################################################################

-- =====================================================================
-- 1. Parámetros configurables del hotel
-- =====================================================================

/**
 * Valores que la operación necesita ajustar sin tocar código ni esquema.
 *
 * El primero que se usa es el plazo de no-show: RES-09 pide que sea
 * "configurable", así que vive acá y no como número fijo en una función.
 */
CREATE TABLE Hotel_Parameter (
    parameter_key   VARCHAR(60)  PRIMARY KEY,
    parameter_value VARCHAR(100) NOT NULL,
    description     VARCHAR(255) NOT NULL,
    update_date     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- 2. Tipos de habitación (HAB-03)
-- =====================================================================

/**
 * Catálogo de la oferta de alojamiento: Simple, Doble, Suite.
 *
 * `max_capacity` es la cantidad máxima de personas y es lo que usa la
 * búsqueda de disponibilidad (RES-05) para filtrar. Los campos de amenities
 * siguen la práctica del mercado: en Booking o Trivago el huésped filtra por
 * ellos antes que por el nombre del tipo.
 */
CREATE TABLE Room_Type (
    room_type_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_type_name VARCHAR(60)  NOT NULL UNIQUE,
    description    VARCHAR(255),
    max_capacity   SMALLINT     NOT NULL,
    max_adults     SMALLINT,
    bed_setup      VARCHAR(80),
    square_meters  NUMERIC(6,2),
    has_balcony    BOOLEAN      NOT NULL DEFAULT FALSE,
    has_minibar    BOOLEAN      NOT NULL DEFAULT FALSE,
    has_air_conditioning BOOLEAN NOT NULL DEFAULT TRUE,
    active         BOOLEAN      NOT NULL DEFAULT TRUE,
    creation_date  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_room_type_capacity CHECK (max_capacity > 0),
    CONSTRAINT ck_room_type_adults
        CHECK (max_adults IS NULL OR (max_adults > 0 AND max_adults <= max_capacity)),
    CONSTRAINT ck_room_type_surface CHECK (square_meters IS NULL OR square_meters > 0)
);

-- =====================================================================
-- 3. Tarifas por tipo de habitación (TAR-01)
-- =====================================================================

/**
 * Historial de precios, no un precio único editable.
 *
 * Cada fila es una tarifa con su período de vigencia. La vigente es la que
 * tiene `valid_to` en NULL. Así, cuando en marzo se consulta cuánto costó una
 * reserva de enero, el dato sigue existiendo: si se pisara el precio, esa
 * información se perdería para siempre.
 *
 * El EXCLUDE impide dos tarifas superpuestas para el mismo tipo. Es la
 * restricción que hace imposible un período con dos precios distintos, algo
 * que un CHECK por fila no puede validar.
 */
CREATE TABLE Room_Type_Rate (
    rate_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_type_id  INT           NOT NULL,
    base_price    NUMERIC(14,2) NOT NULL,
    currency      VARCHAR(3)    NOT NULL DEFAULT 'ARS',
    valid_from    DATE          NOT NULL DEFAULT CURRENT_DATE,
    valid_to      DATE,
    reason        VARCHAR(255),
    employees_id  INT           NOT NULL,
    creation_date TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_rate_price_positive CHECK (base_price > 0),
    CONSTRAINT ck_rate_period CHECK (valid_to IS NULL OR valid_to > valid_from),

    CONSTRAINT fk_rate_room_type FOREIGN KEY (room_type_id) REFERENCES Room_Type(room_type_id),
    CONSTRAINT fk_rate_employee  FOREIGN KEY (employees_id) REFERENCES Employees(employees_id),

    -- Dos tarifas del mismo tipo no pueden solaparse en el tiempo.
    CONSTRAINT ex_rate_no_overlap EXCLUDE USING gist (
        room_type_id WITH =,
        daterange(valid_from, valid_to, '[)') WITH &&
    )
);

CREATE INDEX idx_rate_room_type ON Room_Type_Rate(room_type_id);
CREATE INDEX idx_rate_vigente   ON Room_Type_Rate(room_type_id) WHERE valid_to IS NULL;

-- =====================================================================
-- 4. Habitaciones (HAB-01)
-- =====================================================================

/**
 * Inventario físico del hotel.
 *
 * `room_status` es el estado OPERATIVO de la habitación, distinto del estado
 * de una reserva: una habitación puede estar DISPONIBLE hoy y tener reservas
 * futuras. Quién puede ocuparla en una fecha lo decide la búsqueda de
 * disponibilidad, no esta columna.
 */
CREATE TABLE Room (
    room_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_number   VARCHAR(10)  NOT NULL UNIQUE,
    room_type_id  INT          NOT NULL,
    floor_number  SMALLINT,
    room_status   VARCHAR(20)  NOT NULL DEFAULT 'DISPONIBLE',
    view_type     VARCHAR(40),
    observations  VARCHAR(255),
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    creation_date TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_room_status
        CHECK (room_status IN ('DISPONIBLE', 'OCUPADA', 'LIMPIEZA', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO')),

    CONSTRAINT fk_room_type FOREIGN KEY (room_type_id) REFERENCES Room_Type(room_type_id)
);

CREATE INDEX idx_room_type   ON Room(room_type_id);
CREATE INDEX idx_room_status ON Room(room_status);

-- =====================================================================
-- 5. Huéspedes (RES-01)
-- =====================================================================

/**
 * Perfil del cliente. Se separa de la reserva porque un huésped vuelve: al
 * tenerlo como entidad propia se puede consultar su historial de estadías, y
 * la reserva no repite sus datos en cada visita.
 */
CREATE TABLE Guest (
    guest_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_type   VARCHAR(20)  NOT NULL DEFAULT 'DNI',
    document_number VARCHAR(30)  NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(150),
    phone           VARCHAR(30),
    birth_date      DATE,
    nationality     VARCHAR(60),
    address         VARCHAR(200),
    observations    VARCHAR(255),
    guest_state     BOOLEAN      NOT NULL DEFAULT TRUE,
    creation_date   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_guest_document_type
        CHECK (document_type IN ('DNI', 'PASAPORTE', 'CEDULA', 'LC', 'LE')),
    CONSTRAINT ck_guest_email
        CHECK (email IS NULL OR email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    CONSTRAINT ck_guest_birth_date
        CHECK (birth_date IS NULL OR birth_date < CURRENT_DATE),

    CONSTRAINT uq_guest_document UNIQUE (document_type, document_number)
);

CREATE INDEX idx_guest_lastname ON Guest(last_name, first_name);
CREATE INDEX idx_guest_document ON Guest(document_number);

-- =====================================================================
-- 6. Políticas de cancelación
-- =====================================================================

/**
 * Cada reserva se guarda con la política que tenía al momento de reservarse.
 * Si el hotel endurece sus condiciones en julio, las reservas de junio
 * conservan las que el huésped aceptó: cambiarlas retroactivamente sería
 * modificar un acuerdo ya cerrado.
 */
CREATE TABLE Cancellation_Policy (
    policy_id            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    policy_name          VARCHAR(80)  NOT NULL UNIQUE,
    description          VARCHAR(255) NOT NULL,
    free_cancel_hours    SMALLINT     NOT NULL DEFAULT 24,
    penalty_percentage   NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    active               BOOLEAN      NOT NULL DEFAULT TRUE,

    CONSTRAINT ck_policy_hours   CHECK (free_cancel_hours >= 0),
    CONSTRAINT ck_policy_penalty CHECK (penalty_percentage >= 0 AND penalty_percentage <= 100)
);

-- =====================================================================
-- 7. Bloqueo temporal durante la carga (RES-01)
-- =====================================================================

/**
 * Retención de una habitación mientras el recepcionista completa la reserva.
 *
 * Es lo mismo que hace Booking cuando avisa "quedan pocas, te la reservamos
 * por 10 minutos". Sin esto, dos recepcionistas pueden estar cargando la
 * misma habitación al mismo tiempo y solo uno lo descubre al guardar.
 *
 * El EXCLUDE aplica solo a las retenciones vigentes y no liberadas.
 */
CREATE TABLE Room_Hold (
    hold_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id        INT         NOT NULL,
    check_in_date  DATE        NOT NULL,
    check_out_date DATE        NOT NULL,
    employees_id   INT         NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at     TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes'),
    released       BOOLEAN     NOT NULL DEFAULT FALSE,

    CONSTRAINT ck_hold_dates CHECK (check_out_date > check_in_date),

    CONSTRAINT fk_hold_room     FOREIGN KEY (room_id)      REFERENCES Room(room_id),
    CONSTRAINT fk_hold_employee FOREIGN KEY (employees_id) REFERENCES Employees(employees_id),

    /**
     * El predicado solo puede usar expresiones inmutables, así que filtra por
     * `released` y no por la fecha de vencimiento: CURRENT_TIMESTAMP cambia en
     * cada consulta y PostgreSQL no lo admite en un índice.
     *
     * Por eso las retenciones vencidas se liberan con fn_release_expired_holds(),
     * que el backend ejecuta periódicamente.
     */
    CONSTRAINT ex_hold_no_overlap EXCLUDE USING gist (
        room_id WITH =,
        daterange(check_in_date, check_out_date, '[)') WITH &&
    ) WHERE (released = FALSE)
);

CREATE INDEX idx_hold_room ON Room_Hold(room_id) WHERE released = FALSE;

-- =====================================================================
-- 8. Reservas (RES-01, RES-05, RES-09, RES-11)
-- =====================================================================

/**
 * Estados y su flujo:
 *   PENDIENTE   -> tomada, sin confirmar (falta seña o datos)
 *   CONFIRMADA  -> asegurada; bloquea la habitación en esas fechas
 *   IN_HOUSE    -> el huésped hizo check-in y está alojado
 *   FINALIZADA  -> hizo check-out
 *   CANCELADA   -> se dio de baja antes del check-in
 *   NO_SHOW     -> no se presentó dentro del plazo configurado
 *
 * `price_per_night` se copia al reservar en lugar de leerse de la tarifa
 * vigente: el precio pactado con el huésped no puede cambiar porque después
 * el hotel actualizó sus tarifas.
 *
 * `nights` y `total_amount` son columnas generadas: las calcula PostgreSQL, de
 * modo que ningún proceso pueda guardar un total que no cierre con las fechas
 * y el precio.
 *
 * El rango es [check_in, check_out): la fecha de salida no cuenta como noche
 * ocupada, así una reserva que termina el 10 y otra que empieza el 10 conviven
 * sin conflicto. Es la convención del rubro.
 */
CREATE TABLE Reservation (
    reservation_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reservation_code   VARCHAR(20)   NOT NULL UNIQUE,
    guest_id           INT           NOT NULL,
    room_id            INT           NOT NULL,
    check_in_date      DATE          NOT NULL,
    check_out_date     DATE          NOT NULL,
    adults             SMALLINT      NOT NULL DEFAULT 1,
    children           SMALLINT      NOT NULL DEFAULT 0,
    price_per_night    NUMERIC(14,2) NOT NULL,
    rate_id            INT,
    policy_id          INT,
    nights             INT           GENERATED ALWAYS AS (check_out_date - check_in_date) STORED,
    total_amount       NUMERIC(14,2) GENERATED ALWAYS AS
                           ((check_out_date - check_in_date) * price_per_night) STORED,
    reservation_status VARCHAR(20)   NOT NULL DEFAULT 'CONFIRMADA',
    reservation_source VARCHAR(40)   NOT NULL DEFAULT 'RECEPCION',
    observations       VARCHAR(255),
    employees_id       INT           NOT NULL,
    creation_date      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at       TIMESTAMPTZ,
    cancellation_reason VARCHAR(255),

    CONSTRAINT ck_reservation_dates   CHECK (check_out_date > check_in_date),
    CONSTRAINT ck_reservation_price   CHECK (price_per_night > 0),
    CONSTRAINT ck_reservation_adults  CHECK (adults > 0),
    CONSTRAINT ck_reservation_children CHECK (children >= 0),
    CONSTRAINT ck_reservation_status
        CHECK (reservation_status IN ('PENDIENTE', 'CONFIRMADA', 'IN_HOUSE', 'FINALIZADA', 'CANCELADA', 'NO_SHOW')),
    CONSTRAINT ck_reservation_source
        CHECK (reservation_source IN ('RECEPCION', 'TELEFONO', 'WEB', 'AGENCIA', 'CORPORATIVO')),
    -- Una reserva cancelada tiene que decir por qué.
    CONSTRAINT ck_reservation_cancel
        CHECK (reservation_status <> 'CANCELADA'
               OR (cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL)),

    CONSTRAINT fk_reservation_guest    FOREIGN KEY (guest_id)     REFERENCES Guest(guest_id),
    CONSTRAINT fk_reservation_room     FOREIGN KEY (room_id)      REFERENCES Room(room_id),
    CONSTRAINT fk_reservation_rate     FOREIGN KEY (rate_id)      REFERENCES Room_Type_Rate(rate_id),
    CONSTRAINT fk_reservation_policy   FOREIGN KEY (policy_id)    REFERENCES Cancellation_Policy(policy_id),
    CONSTRAINT fk_reservation_employee FOREIGN KEY (employees_id) REFERENCES Employees(employees_id),

    /**
     * El corazón de RES-01: dos reservas activas no pueden solaparse en la
     * misma habitación. Lo garantiza el motor con un índice, no la aplicación,
     * así que dos usuarios simultáneos no pueden sobrevender la habitación por
     * más rápido que corran. Las canceladas y los no-show no cuentan.
     */
    CONSTRAINT ex_reservation_no_overlap EXCLUDE USING gist (
        room_id WITH =,
        daterange(check_in_date, check_out_date, '[)') WITH &&
    ) WHERE (reservation_status IN ('PENDIENTE', 'CONFIRMADA', 'IN_HOUSE'))
);

CREATE INDEX idx_reservation_guest  ON Reservation(guest_id);
CREATE INDEX idx_reservation_room   ON Reservation(room_id);
CREATE INDEX idx_reservation_status ON Reservation(reservation_status);
CREATE INDEX idx_reservation_dates  ON Reservation(check_in_date, check_out_date);
CREATE INDEX idx_reservation_employee ON Reservation(employees_id);

-- Las llegadas del día son la consulta más frecuente de recepción.
CREATE INDEX idx_reservation_llegadas
    ON Reservation(check_in_date)
    WHERE reservation_status IN ('PENDIENTE', 'CONFIRMADA');

-- =====================================================================
-- 9. Historial de la reserva (RES-01)
-- =====================================================================

/** Cada cambio de estado, con quién y cuándo. Lo escribe un trigger. */
CREATE TABLE Reservation_Status_History (
    reservation_history_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reservation_id         INT         NOT NULL,
    previous_status        VARCHAR(20),
    new_status             VARCHAR(20) NOT NULL,
    changed_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    employees_id           INT         NOT NULL,
    reason                 VARCHAR(255),

    CONSTRAINT fk_res_history_reservation
        FOREIGN KEY (reservation_id) REFERENCES Reservation(reservation_id) ON DELETE CASCADE,
    CONSTRAINT fk_res_history_employee
        FOREIGN KEY (employees_id) REFERENCES Employees(employees_id)
);

CREATE INDEX idx_res_history_reservation ON Reservation_Status_History(reservation_id);

/**
 * Cambios de fechas o de habitación. Van en tabla aparte del historial de
 * estados porque responden preguntas distintas: una es "por qué se canceló",
 * la otra "quién le cambió la fecha y cuándo".
 */
CREATE TABLE Reservation_Change_Log (
    change_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reservation_id INT          NOT NULL,
    changed_field  VARCHAR(40)  NOT NULL,
    previous_value VARCHAR(100),
    new_value      VARCHAR(100),
    changed_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    employees_id   INT          NOT NULL,
    reason         VARCHAR(255),

    CONSTRAINT ck_change_field
        CHECK (changed_field IN ('check_in_date', 'check_out_date', 'room_id', 'price_per_night', 'adults', 'children')),

    CONSTRAINT fk_res_change_reservation
        FOREIGN KEY (reservation_id) REFERENCES Reservation(reservation_id) ON DELETE CASCADE,
    CONSTRAINT fk_res_change_employee
        FOREIGN KEY (employees_id) REFERENCES Employees(employees_id)
);

CREATE INDEX idx_res_change_reservation ON Reservation_Change_Log(reservation_id);

-- =====================================================================
-- 10. Check-in y check-out (RES-09, RES-11)
-- =====================================================================

/**
 * Van en tablas propias y no como dos columnas de la reserva porque son
 * hechos con datos propios: quién atendió, a qué hora, cuántas personas
 * llegaron efectivamente, qué observaciones quedaron.
 *
 * La relación es 1 a 1 con la reserva, garantizada por el UNIQUE: una reserva
 * no puede tener dos check-in.
 */
CREATE TABLE Reservation_Check_In (
    check_in_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reservation_id   INT         NOT NULL UNIQUE,
    check_in_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actual_adults    SMALLINT,
    actual_children  SMALLINT,
    observations     VARCHAR(255),
    employees_id     INT         NOT NULL,

    CONSTRAINT ck_checkin_guests
        CHECK ((actual_adults IS NULL OR actual_adults > 0)
               AND (actual_children IS NULL OR actual_children >= 0)),

    CONSTRAINT fk_checkin_reservation
        FOREIGN KEY (reservation_id) REFERENCES Reservation(reservation_id),
    CONSTRAINT fk_checkin_employee
        FOREIGN KEY (employees_id) REFERENCES Employees(employees_id)
);

/**
 * `pending_charges` deja registrado si al momento de la salida había consumos
 * sin facturar. RES-11 pide advertirlo, no bloquearlo: en la práctica el
 * huésped a veces se va y la factura se cierra después, y el sistema tiene que
 * poder dejar constancia de eso.
 */
CREATE TABLE Reservation_Check_Out (
    check_out_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reservation_id  INT         NOT NULL UNIQUE,
    check_out_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    pending_charges BOOLEAN     NOT NULL DEFAULT FALSE,
    pending_detail  VARCHAR(255),
    observations    VARCHAR(255),
    employees_id    INT         NOT NULL,

    CONSTRAINT fk_checkout_reservation
        FOREIGN KEY (reservation_id) REFERENCES Reservation(reservation_id),
    CONSTRAINT fk_checkout_employee
        FOREIGN KEY (employees_id) REFERENCES Employees(employees_id)
);

-- =====================================================================
-- 11. Mantenimiento y limpieza (HAB-06)
-- =====================================================================

/**
 * Bloqueo de una habitación por trabajos. Mientras el período está abierto la
 * habitación no se ofrece, igual que si estuviera reservada.
 *
 * `actual_end_date` en NULL significa que sigue abierto; cerrarlo devuelve la
 * habitación a DISPONIBLE.
 */
CREATE TABLE Room_Maintenance (
    maintenance_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id            INT          NOT NULL,
    maintenance_type   VARCHAR(20)  NOT NULL DEFAULT 'MANTENIMIENTO',
    start_date         DATE         NOT NULL,
    estimated_end_date DATE         NOT NULL,
    actual_end_date    DATE,
    reason             VARCHAR(255) NOT NULL,
    closing_notes      VARCHAR(255),
    opened_by          INT          NOT NULL,
    closed_by          INT,
    creation_date      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_maintenance_type
        CHECK (maintenance_type IN ('LIMPIEZA', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO')),
    CONSTRAINT ck_maintenance_dates
        CHECK (estimated_end_date >= start_date),
    CONSTRAINT ck_maintenance_actual_end
        CHECK (actual_end_date IS NULL OR actual_end_date >= start_date),
    CONSTRAINT ck_maintenance_closed
        CHECK (actual_end_date IS NULL OR closed_by IS NOT NULL),

    CONSTRAINT fk_maintenance_room   FOREIGN KEY (room_id)   REFERENCES Room(room_id),
    CONSTRAINT fk_maintenance_opened FOREIGN KEY (opened_by) REFERENCES Employees(employees_id),
    CONSTRAINT fk_maintenance_closed FOREIGN KEY (closed_by) REFERENCES Employees(employees_id),

    -- Dos períodos abiertos no pueden solaparse en la misma habitación.
    CONSTRAINT ex_maintenance_no_overlap EXCLUDE USING gist (
        room_id WITH =,
        daterange(start_date, COALESCE(actual_end_date, estimated_end_date), '[]') WITH &&
    ) WHERE (actual_end_date IS NULL)
);

CREATE INDEX idx_maintenance_room  ON Room_Maintenance(room_id);
CREATE INDEX idx_maintenance_abierto
    ON Room_Maintenance(room_id, start_date)
    WHERE actual_end_date IS NULL;

-- =====================================================================
-- 12. Reglas de negocio del módulo de reservas
-- =====================================================================

/**
 * HAB-03: un tipo con habitaciones asociadas no se elimina.
 *
 * La FK sola impediría el borrado, pero con un mensaje de PostgreSQL que el
 * usuario no entiende. Acá se explica qué hacer: desactivarlo.
 */
CREATE OR REPLACE FUNCTION fn_room_type_no_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_cantidad INT;
BEGIN
    SELECT COUNT(*) INTO v_cantidad FROM Room WHERE room_type_id = OLD.room_type_id;

    IF v_cantidad > 0 THEN
        RAISE EXCEPTION 'No se puede eliminar el tipo "%" porque tiene % habitación(es) asociada(s). Desactivalo en su lugar.',
            OLD.room_type_name, v_cantidad;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_room_type_no_delete
    BEFORE DELETE ON Room_Type
    FOR EACH ROW EXECUTE FUNCTION fn_room_type_no_delete();

/** HAB-01: la habitación tiene que apuntar a un tipo activo. */
CREATE OR REPLACE FUNCTION fn_check_room_type_active()
RETURNS TRIGGER AS $$
DECLARE
    v_activo BOOLEAN;
    v_nombre VARCHAR(60);
BEGIN
    SELECT active, room_type_name INTO v_activo, v_nombre
    FROM Room_Type WHERE room_type_id = NEW.room_type_id;

    IF NOT v_activo THEN
        RAISE EXCEPTION 'El tipo de habitación "%" está inactivo y no puede asignarse.', v_nombre;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_check_room_type_active
    BEFORE INSERT OR UPDATE OF room_type_id ON Room
    FOR EACH ROW EXECUTE FUNCTION fn_check_room_type_active();

/**
 * TAR-01: al cargar una tarifa nueva se cierra automáticamente la anterior.
 *
 * Sin esto, el operador tendría que acordarse de poner el `valid_to` de la
 * vieja antes de crear la nueva, y si se olvida el EXCLUDE rechaza la carga
 * con un error incomprensible.
 */
CREATE OR REPLACE FUNCTION fn_close_previous_rate()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE Room_Type_Rate
    SET valid_to = NEW.valid_from
    WHERE room_type_id = NEW.room_type_id
      AND rate_id <> NEW.rate_id
      AND valid_to IS NULL
      AND valid_from < NEW.valid_from;

    -- Es un trigger BEFORE: devolver NULL cancelaría el alta de la tarifa nueva.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_close_previous_rate
    BEFORE INSERT ON Room_Type_Rate
    FOR EACH ROW EXECUTE FUNCTION fn_close_previous_rate();

/** Genera el código de reserva: RES-2026-000001. */
CREATE SEQUENCE seq_reservation_code START 1;

CREATE OR REPLACE FUNCTION fn_generate_reservation_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.reservation_code IS NULL OR TRIM(NEW.reservation_code) = '' THEN
        NEW.reservation_code := 'RES-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
                                LPAD(NEXTVAL('seq_reservation_code')::TEXT, 6, '0');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_generate_reservation_code
    BEFORE INSERT ON Reservation
    FOR EACH ROW EXECUTE FUNCTION fn_generate_reservation_code();

/**
 * Validaciones de la reserva que el EXCLUDE no cubre:
 *   - la habitación tiene que estar activa y no fuera de servicio
 *   - la cantidad de personas no puede superar la capacidad del tipo
 *   - las fechas no pueden pisar un período de mantenimiento abierto
 *   - una reserva IN_HOUSE o FINALIZADA no se modifica ni se cancela
 */
CREATE OR REPLACE FUNCTION fn_validate_reservation()
RETURNS TRIGGER AS $$
DECLARE
    v_room       RECORD;
    v_capacidad  SMALLINT;
    v_personas   SMALLINT;
    v_bloqueo    RECORD;
BEGIN
    SELECT r.room_number, r.active, r.room_status, rt.max_capacity, rt.room_type_name
    INTO v_room
    FROM Room r
    JOIN Room_Type rt ON rt.room_type_id = r.room_type_id
    WHERE r.room_id = NEW.room_id;

    IF NOT v_room.active THEN
        RAISE EXCEPTION 'La habitación % está dada de baja.', v_room.room_number;
    END IF;

    IF v_room.room_status = 'FUERA_DE_SERVICIO' THEN
        RAISE EXCEPTION 'La habitación % está fuera de servicio.', v_room.room_number;
    END IF;

    v_personas := NEW.adults + NEW.children;
    IF v_personas > v_room.max_capacity THEN
        RAISE EXCEPTION 'La habitación % (%) admite hasta % personas y se intentan alojar %.',
            v_room.room_number, v_room.room_type_name, v_room.max_capacity, v_personas;
    END IF;

    -- Mantenimiento abierto que se superpone con la estadía.
    IF NEW.reservation_status IN ('PENDIENTE', 'CONFIRMADA', 'IN_HOUSE') THEN
        SELECT start_date, estimated_end_date, reason INTO v_bloqueo
        FROM Room_Maintenance
        WHERE room_id = NEW.room_id
          AND actual_end_date IS NULL
          AND daterange(start_date, estimated_end_date, '[]')
              && daterange(NEW.check_in_date, NEW.check_out_date, '[)')
        LIMIT 1;

        IF FOUND THEN
            RAISE EXCEPTION 'La habitación % tiene un bloqueo del % al % (%).',
                v_room.room_number, v_bloqueo.start_date, v_bloqueo.estimated_end_date, v_bloqueo.reason;
        END IF;
    END IF;

    -- RES-01: lo ya iniciado o cerrado no se toca.
    IF TG_OP = 'UPDATE' AND OLD.reservation_status IN ('FINALIZADA', 'CANCELADA', 'NO_SHOW') THEN
        IF NEW.check_in_date  <> OLD.check_in_date
           OR NEW.check_out_date <> OLD.check_out_date
           OR NEW.room_id     <> OLD.room_id THEN
            RAISE EXCEPTION 'No se puede modificar una reserva en estado %.', OLD.reservation_status;
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.reservation_status = 'IN_HOUSE'
       AND NEW.reservation_status = 'CANCELADA' THEN
        RAISE EXCEPTION 'No se puede cancelar una reserva con check-in realizado. Corresponde registrar el check-out.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_validate_reservation
    BEFORE INSERT OR UPDATE ON Reservation
    FOR EACH ROW EXECUTE FUNCTION fn_validate_reservation();

/** Historial de estados de la reserva. */
CREATE OR REPLACE FUNCTION fn_log_reservation_status()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO Reservation_Status_History (reservation_id, previous_status, new_status, employees_id)
        VALUES (NEW.reservation_id, NULL, NEW.reservation_status, NEW.employees_id);

    ELSIF OLD.reservation_status <> NEW.reservation_status THEN
        INSERT INTO Reservation_Status_History (reservation_id, previous_status, new_status, employees_id, reason)
        VALUES (NEW.reservation_id, OLD.reservation_status, NEW.reservation_status,
                NEW.employees_id, NEW.cancellation_reason);
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_log_reservation_status
    AFTER INSERT OR UPDATE ON Reservation
    FOR EACH ROW EXECUTE FUNCTION fn_log_reservation_status();

/** Registra qué cambió de una reserva: fechas, habitación, precio, personas. */
CREATE OR REPLACE FUNCTION fn_log_reservation_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.check_in_date <> OLD.check_in_date THEN
        INSERT INTO Reservation_Change_Log (reservation_id, changed_field, previous_value, new_value, employees_id)
        VALUES (NEW.reservation_id, 'check_in_date', OLD.check_in_date::TEXT, NEW.check_in_date::TEXT, NEW.employees_id);
    END IF;

    IF NEW.check_out_date <> OLD.check_out_date THEN
        INSERT INTO Reservation_Change_Log (reservation_id, changed_field, previous_value, new_value, employees_id)
        VALUES (NEW.reservation_id, 'check_out_date', OLD.check_out_date::TEXT, NEW.check_out_date::TEXT, NEW.employees_id);
    END IF;

    IF NEW.room_id <> OLD.room_id THEN
        INSERT INTO Reservation_Change_Log (reservation_id, changed_field, previous_value, new_value, employees_id)
        VALUES (NEW.reservation_id, 'room_id', OLD.room_id::TEXT, NEW.room_id::TEXT, NEW.employees_id);
    END IF;

    IF NEW.price_per_night <> OLD.price_per_night THEN
        INSERT INTO Reservation_Change_Log (reservation_id, changed_field, previous_value, new_value, employees_id)
        VALUES (NEW.reservation_id, 'price_per_night', OLD.price_per_night::TEXT, NEW.price_per_night::TEXT, NEW.employees_id);
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_log_reservation_changes
    AFTER UPDATE ON Reservation
    FOR EACH ROW EXECUTE FUNCTION fn_log_reservation_changes();

/**
 * RES-09: el check-in valida la reserva y pone la habitación en OCUPADA.
 *
 * El estado de la habitación lo mueve la base y no la aplicación: si dependiera
 * del backend, un error en medio del proceso dejaría la reserva iniciada y la
 * habitación figurando como libre.
 */
CREATE OR REPLACE FUNCTION fn_process_check_in()
RETURNS TRIGGER AS $$
DECLARE
    v_reserva RECORD;
BEGIN
    SELECT * INTO v_reserva FROM Reservation WHERE reservation_id = NEW.reservation_id;

    IF v_reserva.reservation_status NOT IN ('CONFIRMADA', 'PENDIENTE') THEN
        RAISE EXCEPTION 'Solo se puede hacer check-in de una reserva confirmada o pendiente. Estado actual: %.',
            v_reserva.reservation_status;
    END IF;

    IF CURRENT_DATE < v_reserva.check_in_date THEN
        RAISE EXCEPTION 'El check-in no puede registrarse antes del %.', v_reserva.check_in_date;
    END IF;

    UPDATE Reservation
    SET reservation_status = 'IN_HOUSE'
    WHERE reservation_id = NEW.reservation_id;

    UPDATE Room
    SET room_status = 'OCUPADA'
    WHERE room_id = v_reserva.room_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_process_check_in
    AFTER INSERT ON Reservation_Check_In
    FOR EACH ROW EXECUTE FUNCTION fn_process_check_in();

/**
 * RES-11: el check-out cierra la estadía y manda la habitación a LIMPIEZA.
 *
 * No vuelve directo a DISPONIBLE: en un hotel real la habitación pasa primero
 * por housekeeping, y ofrecerla antes de que esté limpia es un problema.
 */
CREATE OR REPLACE FUNCTION fn_process_check_out()
RETURNS TRIGGER AS $$
DECLARE
    v_reserva RECORD;
BEGIN
    SELECT * INTO v_reserva FROM Reservation WHERE reservation_id = NEW.reservation_id;

    IF v_reserva.reservation_status <> 'IN_HOUSE' THEN
        RAISE EXCEPTION 'Solo se puede hacer check-out de una reserva con check-in realizado. Estado actual: %.',
            v_reserva.reservation_status;
    END IF;

    UPDATE Reservation
    SET reservation_status = 'FINALIZADA'
    WHERE reservation_id = NEW.reservation_id;

    UPDATE Room
    SET room_status = 'LIMPIEZA'
    WHERE room_id = v_reserva.room_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_process_check_out
    AFTER INSERT ON Reservation_Check_Out
    FOR EACH ROW EXECUTE FUNCTION fn_process_check_out();

/** HAB-06: abrir o cerrar un bloqueo mueve el estado de la habitación. */
CREATE OR REPLACE FUNCTION fn_sync_room_maintenance()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- No se bloquea una habitación con un huésped adentro.
        IF EXISTS (SELECT 1 FROM Room WHERE room_id = NEW.room_id AND room_status = 'OCUPADA') THEN
            RAISE EXCEPTION 'La habitación está ocupada: no se puede iniciar el bloqueo hasta el check-out.';
        END IF;

        UPDATE Room
        SET room_status = CASE NEW.maintenance_type
                              WHEN 'LIMPIEZA' THEN 'LIMPIEZA'
                              WHEN 'FUERA_DE_SERVICIO' THEN 'FUERA_DE_SERVICIO'
                              ELSE 'MANTENIMIENTO'
                          END
        WHERE room_id = NEW.room_id;

    ELSIF TG_OP = 'UPDATE' AND OLD.actual_end_date IS NULL AND NEW.actual_end_date IS NOT NULL THEN
        -- Se cerró el bloqueo: la habitación vuelve a estar disponible.
        UPDATE Room
        SET room_status = 'DISPONIBLE'
        WHERE room_id = NEW.room_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sync_room_maintenance
    AFTER INSERT OR UPDATE ON Room_Maintenance
    FOR EACH ROW EXECUTE FUNCTION fn_sync_room_maintenance();

/** No se bloquea una habitación que ya tiene reservas activas en esas fechas. */
CREATE OR REPLACE FUNCTION fn_check_maintenance_vs_reservation()
RETURNS TRIGGER AS $$
DECLARE
    v_codigo VARCHAR(20);
BEGIN
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

CREATE TRIGGER tr_check_maintenance_vs_reservation
    BEFORE INSERT ON Room_Maintenance
    FOR EACH ROW EXECUTE FUNCTION fn_check_maintenance_vs_reservation();

-- =====================================================================
-- 13. Funciones de consulta
-- =====================================================================

/**
 * RES-05: habitaciones disponibles entre dos fechas, con el precio total.
 *
 * Es una función y no una vista porque depende de los parámetros que ingresa
 * el recepcionista. Descarta las habitaciones con reservas solapadas, con
 * bloqueos abiertos y con retenciones vigentes de otro usuario.
 *
 *   SELECT * FROM fn_available_rooms('2026-10-01', '2026-10-05', 2);
 */
CREATE OR REPLACE FUNCTION fn_available_rooms(
    p_check_in  DATE,
    p_check_out DATE,
    p_capacity  SMALLINT DEFAULT 1
)
RETURNS TABLE (
    room_id        INT,
    room_number    VARCHAR(10),
    room_type_id   INT,
    room_type_name VARCHAR(60),
    max_capacity   SMALLINT,
    floor_number   SMALLINT,
    price_per_night NUMERIC(14,2),
    nights         INT,
    total_estimated NUMERIC(14,2)
) AS $$
BEGIN
    IF p_check_out <= p_check_in THEN
        RAISE EXCEPTION 'La fecha de salida tiene que ser posterior a la de ingreso.';
    END IF;

    RETURN QUERY
    SELECT
        r.room_id,
        r.room_number,
        rt.room_type_id,
        rt.room_type_name,
        rt.max_capacity,
        r.floor_number,
        rate.base_price,
        (p_check_out - p_check_in) AS nights,
        ((p_check_out - p_check_in) * rate.base_price)::NUMERIC(14,2) AS total_estimated
    FROM Room r
    JOIN Room_Type rt ON rt.room_type_id = r.room_type_id
    JOIN LATERAL (
        SELECT rr.base_price
        FROM Room_Type_Rate rr
        WHERE rr.room_type_id = rt.room_type_id
          AND rr.valid_from <= p_check_in
          AND (rr.valid_to IS NULL OR rr.valid_to > p_check_in)
        ORDER BY rr.valid_from DESC
        LIMIT 1
    ) rate ON TRUE
    WHERE r.active
      AND rt.active
      AND r.room_status <> 'FUERA_DE_SERVICIO'
      AND rt.max_capacity >= p_capacity
      -- Sin reservas activas superpuestas
      AND NOT EXISTS (
          SELECT 1 FROM Reservation res
          WHERE res.room_id = r.room_id
            AND res.reservation_status IN ('PENDIENTE', 'CONFIRMADA', 'IN_HOUSE')
            AND daterange(res.check_in_date, res.check_out_date, '[)')
                && daterange(p_check_in, p_check_out, '[)')
      )
      -- Sin bloqueos de mantenimiento abiertos superpuestos
      AND NOT EXISTS (
          SELECT 1 FROM Room_Maintenance rm
          WHERE rm.room_id = r.room_id
            AND rm.actual_end_date IS NULL
            AND daterange(rm.start_date, rm.estimated_end_date, '[]')
                && daterange(p_check_in, p_check_out, '[)')
      )
      -- Sin retenciones vigentes de otra carga en curso
      AND NOT EXISTS (
          SELECT 1 FROM Room_Hold h
          WHERE h.room_id = r.room_id
            AND h.released = FALSE
            AND h.expires_at > CURRENT_TIMESTAMP
            AND daterange(h.check_in_date, h.check_out_date, '[)')
                && daterange(p_check_in, p_check_out, '[)')
      )
    ORDER BY rt.room_type_name, r.room_number;
END;
$$ LANGUAGE plpgsql;

/**
 * RES-09: marca como NO_SHOW las reservas que no registraron check-in dentro
 * del plazo configurado, y libera la habitación.
 *
 * Se ejecuta desde un job programado o desde el backend al abrir el turno:
 *   SELECT fn_process_no_shows();
 */
CREATE OR REPLACE FUNCTION fn_process_no_shows()
RETURNS INT AS $$
DECLARE
    v_horas     INT;
    v_afectadas INT;
BEGIN
    SELECT COALESCE(parameter_value::INT, 24) INTO v_horas
    FROM Hotel_Parameter WHERE parameter_key = 'NO_SHOW_HOURS';

    v_horas := COALESCE(v_horas, 24);

    WITH vencidas AS (
        UPDATE Reservation
        SET reservation_status = 'NO_SHOW'
        WHERE reservation_status IN ('PENDIENTE', 'CONFIRMADA')
          AND check_in_date + (v_horas * INTERVAL '1 hour') < CURRENT_TIMESTAMP
          AND NOT EXISTS (
              SELECT 1 FROM Reservation_Check_In ci
              WHERE ci.reservation_id = Reservation.reservation_id
          )
        RETURNING room_id
    )
    SELECT COUNT(*) INTO v_afectadas FROM vencidas;

    RETURN v_afectadas;
END;
$$ LANGUAGE plpgsql;

/** Libera las retenciones vencidas. Se ejecuta junto con el proceso anterior. */
CREATE OR REPLACE FUNCTION fn_release_expired_holds()
RETURNS INT AS $$
DECLARE
    v_afectadas INT;
BEGIN
    WITH liberadas AS (
        UPDATE Room_Hold
        SET released = TRUE
        WHERE released = FALSE
          AND expires_at <= CURRENT_TIMESTAMP
        RETURNING hold_id
    )
    SELECT COUNT(*) INTO v_afectadas FROM liberadas;

    RETURN v_afectadas;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 14. Vistas del módulo de reservas
-- =====================================================================

/**
 * HAB-04: panel consolidado de tipos de habitación.
 * Capacidad, precio vigente, cantidad de habitaciones activas y estado, en una
 * sola consulta.
 */
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
      AND rr.valid_to IS NULL
    ORDER BY rr.valid_from DESC
    LIMIT 1
) rate ON TRUE
GROUP BY rt.room_type_id, rt.room_type_name, rt.description, rt.max_capacity,
         rt.bed_setup, rt.active, rate.base_price, rate.currency, rate.valid_from;

/** Reservas con huésped, habitación y estado resueltos. */
CREATE OR REPLACE VIEW v_reservation_detail AS
SELECT
    res.reservation_id,
    res.reservation_code,
    res.reservation_status,
    res.check_in_date,
    res.check_out_date,
    res.nights,
    res.adults,
    res.children,
    res.price_per_night,
    res.total_amount,
    res.reservation_source,
    g.guest_id,
    g.last_name || ', ' || g.first_name AS guest_name,
    g.document_type || ' ' || g.document_number AS guest_document,
    g.email  AS guest_email,
    g.phone  AS guest_phone,
    r.room_id,
    r.room_number,
    r.room_status,
    rt.room_type_name,
    ci.check_in_at,
    co.check_out_at,
    co.pending_charges,
    e.employees_name || ' ' || e.employees_lastname AS registered_by,
    res.creation_date,
    CASE
        WHEN res.reservation_status IN ('PENDIENTE', 'CONFIRMADA')
             AND res.check_in_date < CURRENT_DATE THEN TRUE
        ELSE FALSE
    END AS is_overdue_check_in
FROM Reservation res
JOIN Guest g      ON g.guest_id = res.guest_id
JOIN Room r       ON r.room_id = res.room_id
JOIN Room_Type rt ON rt.room_type_id = r.room_type_id
JOIN Employees e  ON e.employees_id = res.employees_id
LEFT JOIN Reservation_Check_In  ci ON ci.reservation_id = res.reservation_id
LEFT JOIN Reservation_Check_Out co ON co.reservation_id = res.reservation_id;

/** Estado actual de cada habitación, con la reserva que la ocupa si la hay. */
CREATE OR REPLACE VIEW v_room_status_board AS
SELECT
    r.room_id,
    r.room_number,
    r.floor_number,
    rt.room_type_name,
    rt.max_capacity,
    r.room_status,
    r.active,
    actual.reservation_code AS current_reservation,
    actual.check_out_date   AS current_check_out,
    proxima.reservation_code AS next_reservation,
    proxima.check_in_date    AS next_check_in,
    bloqueo.maintenance_type,
    bloqueo.estimated_end_date AS blocked_until
FROM Room r
JOIN Room_Type rt ON rt.room_type_id = r.room_type_id
LEFT JOIN LATERAL (
    SELECT res.reservation_code, res.check_out_date
    FROM Reservation res
    WHERE res.room_id = r.room_id
      AND res.reservation_status = 'IN_HOUSE'
    LIMIT 1
) actual ON TRUE
LEFT JOIN LATERAL (
    SELECT res.reservation_code, res.check_in_date
    FROM Reservation res
    WHERE res.room_id = r.room_id
      AND res.reservation_status IN ('PENDIENTE', 'CONFIRMADA')
      AND res.check_in_date >= CURRENT_DATE
    ORDER BY res.check_in_date
    LIMIT 1
) proxima ON TRUE
LEFT JOIN LATERAL (
    SELECT rm.maintenance_type, rm.estimated_end_date
    FROM Room_Maintenance rm
    WHERE rm.room_id = r.room_id
      AND rm.actual_end_date IS NULL
    ORDER BY rm.start_date
    LIMIT 1
) bloqueo ON TRUE;

/** Historial de tarifas con su período de vigencia legible. */
CREATE OR REPLACE VIEW v_rate_history AS
SELECT
    rr.rate_id,
    rt.room_type_id,
    rt.room_type_name,
    rr.base_price,
    rr.currency,
    rr.valid_from,
    rr.valid_to,
    (rr.valid_to IS NULL) AS is_current,
    rr.reason,
    e.employees_name || ' ' || e.employees_lastname AS updated_by,
    rr.creation_date
FROM Room_Type_Rate rr
JOIN Room_Type rt ON rt.room_type_id = rr.room_type_id
JOIN Employees e  ON e.employees_id = rr.employees_id
ORDER BY rt.room_type_name, rr.valid_from DESC;


-- ##########################################################################
-- DATOS SEMILLA — Sprint 1 (stock e insumos)
-- ##########################################################################

INSERT INTO Roles (rol_name, rol_pass, rol_description) VALUES
    ('ADMINISTRADOR',   '$2b$10$3euPcmQFCiblsZeEu5s7p.9OVHgeHWFxCiWFzoOOOOOOOOOOOOOOO', 'Acceso total al sistema'),
    ('ENCARGADO_STOCK', '$2b$10$3euPcmQFCiblsZeEu5s7p.9OVHgeHWFxCiWFzoOOOOOOOOOOOOOOO', 'Supervisión de compras y depósitos'),
    ('GOBERNANZA',      '$2b$10$3euPcmQFCiblsZeEu5s7p.9OVHgeHWFxCiWFzoOOOOOOOOOOOOOOO', 'Blanco, amoblamiento y limpieza'),
    ('RECEPCION',       '$2b$10$3euPcmQFCiblsZeEu5s7p.9OVHgeHWFxCiWFzoOOOOOOOOOOOOOOO', 'Reservas, check-in y check-out')
ON CONFLICT (rol_name) DO NOTHING;

INSERT INTO Employees (rol_id, employees_name, employees_lastname, employees_email, employees_phone)
SELECT r.rol_id, e.nombre, e.apellido, e.email, e.telefono
FROM (VALUES
    ('ADMINISTRADOR',   'Carlos',  'Gómez',    'cgomez@hotelalejandro.com',    '+543874112233'),
    ('ENCARGADO_STOCK', 'Mariana', 'López',    'mlopez@hotelalejandro.com',    '+543874445566'),
    ('GOBERNANZA',      'Sonia',   'Martínez', 'smartinez@hotelalejandro.com', '+543874778899'),
    ('RECEPCION',       'Lucía',   'Ramírez',  'lramirez@hotelalejandro.com',  '+543874221100')
) AS e(rol, nombre, apellido, email, telefono)
JOIN Roles r ON r.rol_name = e.rol
ON CONFLICT (employees_email) DO NOTHING;

INSERT INTO Suppliers (supplier_legal_name, supplier_trade_name, supplier_cuit, supplier_email, supplier_phone, supplier_address) VALUES
    ('Distribuidora Textil del Norte S.A.', 'Textil Norte',  '30-71123456-8', 'ventas@textilnorte.com',   '0387-4311000', 'Av. Chile 1450, Salta'),
    ('Química Salteña S.R.L.',              'Química Salta', '30-65498732-1', 'contacto@quimicasalta.com','0387-4223344', 'Av. Tavella 2800, Salta'),
    ('Bebidas y Alimentos S.A.',            'Bebidas NOA',   '30-58963214-5', 'pedidos@bebidasnoa.com',   '0387-4950011', 'Ruta 68 Km 5, Cerrillos')
ON CONFLICT (supplier_cuit) DO NOTHING;

INSERT INTO Categories (category_name, category_description) VALUES
    ('Blancos y Mantelería', 'Toallas, sábanas, fundas, manteles y servilletas'),
    ('Artículos de Limpieza','Detergentes, desinfectantes, lavandina, escobas'),
    ('Amenities y Baño',     'Jabones, champú, acondicionador, gorros de ducha'),
    ('Frigobar y Snacks',    'Aguas, gaseosas, vinos, chocolates y frutos secos')
ON CONFLICT (category_name) DO NOTHING;

INSERT INTO Articles (category_id, article_code, article_number, article_name, article_compound_name,
                      article_description, article_unit_of_measure, article_stock_min_general)
SELECT c.category_id, a.codigo, a.numero, a.nombre, a.compuesto, a.descripcion, a.unidad, a.minimo
FROM (VALUES
    ('Blancos y Mantelería', 'BLA-001', '001', 'Sábana 2 Plazas 180 hilos',       'Sábana ajustable blanca 2 plazas', 'Sábana ajustable blanca para cama matrimonial', 'UNIDAD', 20.00),
    ('Blancos y Mantelería', 'BLA-002', '002', 'Toallón de Baño 500g',            'Toallón blanco algodón 90x150',    'Toallón blanco de algodón puro 90x150cm',       'UNIDAD', 30.00),
    ('Artículos de Limpieza','LIM-001', '003', 'Detergente Multiuso Concentrado', 'Detergente concentrado bidón 5L',  'Bidón de desinfectante líquido',                'BIDON',   5.00),
    ('Amenities y Baño',     'AME-001', '004', 'Jabón Fraccional 20g',            'Jabón individual huéspedes 20g',   'Jabón en pastilla individual para huéspedes',   'CAJA',   10.00),
    ('Frigobar y Snacks',    'FRI-001', '005', 'Agua Mineral Sin Gas 500ml',      'Agua mineral PET 500ml',           'Botella PET agua mineral',                      'UNIDAD', 50.00),
    ('Frigobar y Snacks',    'FRI-002', '006', 'Vino Malbec Reserva 750ml',       'Malbec reserva 750ml frigobar',    'Vino para reposición de frigobar en Suite',     'UNIDAD', 12.00)
) AS a(categoria, codigo, numero, nombre, compuesto, descripcion, unidad, minimo)
JOIN Categories c ON c.category_name = a.categoria
ON CONFLICT (article_code) DO NOTHING;

INSERT INTO Deposit (deposit_name, deposit_location) VALUES
    ('Depósito Central',              'Subsuelo - Sector Compras'),
    ('Office Gobernanza Piso 1',      'Piso 1 - Pasillo Central'),
    ('Office Gobernanza Piso 2',      'Piso 2 - Pasillo Central'),
    ('Depósito Resto Bar / Frigobar', 'Planta Baja - Cocina Principal')
ON CONFLICT (deposit_name) DO NOTHING;

INSERT INTO Articles_Deposit_Stock (article_id, deposit_id, stock_amount)
SELECT a.article_id, d.deposit_id, s.cantidad
FROM (VALUES
    ('BLA-001', 'Depósito Central',              100.00),
    ('BLA-002', 'Depósito Central',              150.00),
    ('BLA-002', 'Office Gobernanza Piso 1',       20.00),
    ('LIM-001', 'Depósito Central',               15.00),
    ('AME-001', 'Depósito Central',               25.00),
    ('FRI-001', 'Depósito Resto Bar / Frigobar', 120.00),
    ('FRI-002', 'Depósito Resto Bar / Frigobar',  30.00)
) AS s(codigo, deposito, cantidad)
JOIN Articles a ON a.article_code = s.codigo
JOIN Deposit  d ON d.deposit_name = s.deposito
ON CONFLICT (article_id, deposit_id) DO NOTHING;

INSERT INTO Movement_Type (movement_type, description, effect) VALUES
    ('INGRESO',         'Entrada de mercadería al stock',           'SUMA'),
    ('EGRESO',          'Salida de mercadería del stock',           'RESTA'),
    ('TRANSFERENCIA',   'Traslado de mercadería entre depósitos',   'TRANSFERENCIA'),
    ('CONSUMO',         'Consumo interno de insumos',               'RESTA'),
    ('AJUSTE_POSITIVO', 'Ajuste de inventario que suma stock',      'SUMA'),
    ('AJUSTE_NEGATIVO', 'Ajuste de inventario que descuenta stock', 'RESTA')
ON CONFLICT (movement_type) DO NOTHING;

-- ##########################################################################
-- DATOS SEMILLA — Sprint 2 (proveedores y compras)
-- ##########################################################################

INSERT INTO Tax_Condition (tax_condition_name, description) VALUES
    ('RESPONSABLE_INSCRIPTO', 'IVA responsable inscripto: emite factura A'),
    ('MONOTRIBUTISTA',        'Responsable monotributo: emite factura C'),
    ('EXENTO',                'IVA exento'),
    ('CONSUMIDOR_FINAL',      'Consumidor final')
ON CONFLICT (tax_condition_name) DO NOTHING;

-- Los proveedores de la semilla son empresas: responsable inscripto.
UPDATE Suppliers
SET tax_condition_id = (SELECT tax_condition_id FROM Tax_Condition WHERE tax_condition_name = 'RESPONSABLE_INSCRIPTO')
WHERE tax_condition_id IS NULL;

INSERT INTO Voucher_Type (voucher_type, description, sign, affects_account, is_payable) VALUES
    ('FACTURA_A',    'Factura A de proveedor inscripto',                     1, TRUE,  TRUE),
    ('FACTURA_B',    'Factura B de proveedor',                               1, TRUE,  TRUE),
    ('FACTURA_C',    'Factura C de monotributista',                          1, TRUE,  TRUE),
    ('NOTA_DEBITO',  'Nota de débito: aumenta la deuda con el proveedor',    1, TRUE,  TRUE),
    ('NOTA_CREDITO', 'Nota de crédito: disminuye la deuda con el proveedor', -1, TRUE, FALSE),
    ('REMITO',       'Remito sin valor fiscal, no afecta la cuenta',         1, FALSE, FALSE),
    ('RECIBO',       'Recibo emitido por el proveedor',                      1, FALSE, FALSE)
ON CONFLICT (voucher_type) DO NOTHING;

INSERT INTO Payment_Method (payment_method, description, requires_reference) VALUES
    ('EFECTIVO',      'Pago en efectivo por caja',                            FALSE),
    ('TRANSFERENCIA', 'Transferencia bancaria: requiere número de operación',  TRUE),
    ('CHEQUE',        'Cheque propio o de terceros: requiere número',          TRUE)
ON CONFLICT (payment_method) DO NOTHING;

INSERT INTO Expense_Category (expense_category_name, description) VALUES
    ('Insumos de Limpieza',    'Detergentes, desinfectantes y descartables'),
    ('Blancos y Amoblamiento', 'Reposición de ropa blanca y mobiliario'),
    ('Servicios',              'Luz, gas, agua, internet y telefonía'),
    ('Mantenimiento',          'Reparaciones y obras menores'),
    ('Frigobar y Alimentos',   'Reposición de consumibles de habitaciones')
ON CONFLICT (expense_category_name) DO NOTHING;

-- ##########################################################################
-- DATOS SEMILLA — Sprint 3 (reservas y habitaciones)
-- ##########################################################################

INSERT INTO Hotel_Parameter (parameter_key, parameter_value, description) VALUES
    ('NO_SHOW_HOURS',      '24', 'Horas desde el check-in previsto tras las cuales la reserva pasa a NO_SHOW'),
    ('HOLD_MINUTES',       '10', 'Minutos que dura la retención de una habitación mientras se carga la reserva'),
    ('CHECK_IN_TIME',   '14:00', 'Horario a partir del cual se recibe al huésped'),
    ('CHECK_OUT_TIME',  '10:00', 'Horario límite de salida'),
    ('HOTEL_NAME', 'Hotel Alejandro I', 'Nombre comercial del establecimiento')
ON CONFLICT (parameter_key) DO NOTHING;

INSERT INTO Cancellation_Policy (policy_name, description, free_cancel_hours, penalty_percentage) VALUES
    ('FLEXIBLE',    'Cancelación sin cargo hasta 24 horas antes del check-in',          24,   0.00),
    ('MODERADA',    'Cancelación sin cargo hasta 72 horas antes; luego se cobra la primera noche', 72, 50.00),
    ('ESTRICTA',    'Cancelación sin cargo hasta 7 días antes; luego se cobra el total', 168, 100.00),
    ('NO_REEMBOLSABLE', 'Tarifa promocional: no admite cancelación sin cargo',            0, 100.00)
ON CONFLICT (policy_name) DO NOTHING;

INSERT INTO Room_Type (room_type_name, description, max_capacity, max_adults, bed_setup, square_meters,
                       has_balcony, has_minibar, has_air_conditioning) VALUES
    ('SIMPLE', 'Habitación individual con cama de una plaza y media',              1, 1, '1 cama single',              14.00, FALSE, FALSE, TRUE),
    ('DOBLE',  'Habitación doble con cama matrimonial o dos camas individuales',   2, 2, '1 matrimonial o 2 singles',  20.00, FALSE, TRUE,  TRUE),
    ('TRIPLE', 'Habitación para tres personas, ideal para familias',               3, 3, '1 matrimonial + 1 single',   26.00, TRUE,  TRUE,  TRUE),
    ('SUITE',  'Suite con living independiente, balcón y vista a la ciudad',       4, 3, '1 king + 1 sofá cama',       38.00, TRUE,  TRUE,  TRUE)
ON CONFLICT (room_type_name) DO NOTHING;

-- Tarifa vigente de cada tipo, cargada por el administrador.
INSERT INTO Room_Type_Rate (room_type_id, base_price, currency, valid_from, reason, employees_id)
SELECT rt.room_type_id, t.precio, 'ARS', CURRENT_DATE, 'Tarifa inicial de temporada', e.employees_id
FROM (VALUES
    ('SIMPLE',  45000.00),
    ('DOBLE',   68000.00),
    ('TRIPLE',  89000.00),
    ('SUITE',  135000.00)
) AS t(tipo, precio)
JOIN Room_Type rt ON rt.room_type_name = t.tipo
JOIN Employees e  ON e.employees_email = 'cgomez@hotelalejandro.com';

INSERT INTO Room (room_number, room_type_id, floor_number, view_type)
SELECT h.numero, rt.room_type_id, h.piso, h.vista
FROM (VALUES
    ('101', 'SIMPLE', 1, 'Interna'),
    ('102', 'SIMPLE', 1, 'Interna'),
    ('103', 'DOBLE',  1, 'Ciudad'),
    ('104', 'DOBLE',  1, 'Ciudad'),
    ('105', 'TRIPLE', 1, 'Ciudad'),
    ('201', 'DOBLE',  2, 'Ciudad'),
    ('202', 'DOBLE',  2, 'Cerro'),
    ('203', 'TRIPLE', 2, 'Cerro'),
    ('204', 'SUITE',  2, 'Cerro'),
    ('301', 'SUITE',  3, 'Panorámica')
) AS h(numero, tipo, piso, vista)
JOIN Room_Type rt ON rt.room_type_name = h.tipo
ON CONFLICT (room_number) DO NOTHING;

INSERT INTO Guest (document_type, document_number, first_name, last_name, email, phone, nationality, address) VALUES
    ('DNI',       '30123456', 'Juan',    'Pérez',    'jperez@mail.com',       '+543875112233', 'Argentina', 'Belgrano 450, Salta'),
    ('DNI',       '28456789', 'Ana',     'Suárez',   'asuarez@mail.com',      '+543874556677', 'Argentina', 'Alvarado 1200, Salta'),
    ('PASAPORTE', 'AB1234567','Marco',   'Rossi',    'mrossi@mail.com',       '+390612345678', 'Italia',    'Via Roma 15, Milán')
ON CONFLICT (document_type, document_number) DO NOTHING;

COMMIT;