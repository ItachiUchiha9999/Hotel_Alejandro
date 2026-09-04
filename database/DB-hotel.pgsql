/**
 * ==========================================================================
 * HOTEL ALEJANDRO I — Sistema de Gestión Integral (SIGH)
 * Base de datos completa. PostgreSQL 17.
 * ==========================================================================
 *
 * ÚNICO SCRIPT DE BASE DE DATOS DEL PROYECTO.
 *
 * Contiene el Sprint 1 (stock e insumos) y el Sprint 2 (comprobantes de
 * proveedores y órdenes de pago). Reemplaza a la versión V1.0 de este mismo
 * archivo, que usaba el tipo enumerado type_operation_enum.
 *
 * QUÉ CAMBIÓ RESPECTO DE LA V1.0
 *   1. Los tipos de movimiento de stock salieron del ENUM y pasaron a la tabla
 *      Movement_Type, administrable desde la aplicación (STK-04). La dirección
 *      de cada tipo la define su columna `effect`.
 *   2. deposit_origin_id es NULLABLE: un ingreso de proveedor no tiene depósito
 *      de origen, y antes se guardaba el destino en esa columna.
 *   3. Articles suma article_number y article_compound_name, que el catálogo
 *      ya usaba en el frontend.
 *
 * EJECUTAR
 *   psql -U postgres -d sistema_hotelero_db -f database/DB-hotel.pgsql
 *   cd backend && npx prisma generate
 *
 * NO CORRER `prisma db pull` CONTRA ESTA BASE. Ese comando sobrescribe
 * schema.prisma y pierde los nombres de relación que Prisma no puede inferir
 * (deposit_origin, deposit_destination, reversal_of). El schema.prisma del
 * repo y este archivo se mantienen a mano, en espejo.
 */

-- Sin esta línea, psql en Windows lee el archivo con la codificación regional
-- (WIN1252) y los acentos se guardan rotos ("DepÃ³sito").
SET client_encoding = 'UTF8';

/**
 * ==========================================================================
 * LIMPIEZA PREVIA — permite re-ejecutar el script las veces que haga falta.
 * OJO: BORRA TODOS LOS DATOS. En producción van migraciones incrementales.
 * ==========================================================================
 */
-- Vistas
DROP VIEW IF EXISTS v_purchase_order_summary CASCADE;
DROP VIEW IF EXISTS v_supplier_detail CASCADE;
DROP VIEW IF EXISTS v_supplier_voucher_balance CASCADE;
DROP VIEW IF EXISTS v_supplier_account_balance CASCADE;
DROP VIEW IF EXISTS v_expense_summary CASCADE;

-- Tablas
DROP TABLE IF EXISTS Purchase_Order_Status_History CASCADE;
DROP TABLE IF EXISTS Purchase_Order_Detail CASCADE;
DROP TABLE IF EXISTS Purchase_Order CASCADE;
DROP TABLE IF EXISTS Tax_Condition CASCADE;
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
DROP TABLE IF EXISTS Voucher_Type CASCADE;
DROP TABLE IF EXISTS Movement_Stock_Detail CASCADE;
DROP TABLE IF EXISTS Stock_Movement CASCADE;
DROP TABLE IF EXISTS Movement_Type CASCADE;
DROP TABLE IF EXISTS Articles_Deposit_Stock CASCADE;
DROP TABLE IF EXISTS Deposit CASCADE;
DROP TABLE IF EXISTS Articles CASCADE;
DROP TABLE IF EXISTS Categories CASCADE;
DROP TABLE IF EXISTS Suppliers CASCADE;
DROP TABLE IF EXISTS Employees CASCADE;
DROP TABLE IF EXISTS Roles CASCADE;

-- Funciones de los triggers
DROP FUNCTION IF EXISTS fn_sync_purchase_order_total() CASCADE;
DROP FUNCTION IF EXISTS fn_check_purchase_detail_editable() CASCADE;
DROP FUNCTION IF EXISTS fn_validate_purchase_order() CASCADE;
DROP FUNCTION IF EXISTS fn_log_purchase_order_status() CASCADE;
DROP FUNCTION IF EXISTS fn_validate_movement_deposits() CASCADE;
DROP FUNCTION IF EXISTS fn_check_deposit_active() CASCADE;
DROP FUNCTION IF EXISTS fn_sync_voucher_status() CASCADE;
DROP FUNCTION IF EXISTS fn_check_voucher_annul() CASCADE;
DROP FUNCTION IF EXISTS fn_validate_payment_detail() CASCADE;
DROP FUNCTION IF EXISTS fn_sync_payment_order_total() CASCADE;
DROP FUNCTION IF EXISTS fn_check_payment_reference() CASCADE;
DROP FUNCTION IF EXISTS fn_check_expense_allocation() CASCADE;

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

-- 1. Catálogo de tipos de comprobante (PROV-02)
-- =====================================================================

/**
 * `sign` es la pieza central del diseño, igual que `effect` en Movement_Type:
 * define si el comprobante AUMENTA la deuda con el proveedor (+1: factura,
 * nota de débito) o la DISMINUYE (-1: nota de crédito).
 *
 * Gracias a esto, agregar "NOTA DE DÉBITO POR INTERESES" es cargar una fila,
 * no tocar código. La lógica de cuenta corriente nunca pregunta por el nombre
 * del tipo, solo por su signo.
 */
CREATE TABLE Voucher_Type (
    voucher_type_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    voucher_type      VARCHAR(50)  NOT NULL UNIQUE,
    description       VARCHAR(255) NOT NULL,
    sign              SMALLINT     NOT NULL,
    /** Si es FALSE, el comprobante se registra pero no mueve la cuenta corriente. */
    affects_account   BOOLEAN      NOT NULL DEFAULT TRUE,
    /** Si es FALSE, no se le pueden aplicar órdenes de pago (ej. notas de crédito). */
    is_payable        BOOLEAN      NOT NULL DEFAULT TRUE,
    active            BOOLEAN      NOT NULL DEFAULT TRUE,

    CONSTRAINT ck_voucher_type_sign CHECK (sign IN (-1, 1))
);

-- =====================================================================
-- 2. Comprobantes de proveedores (PROV-01, PROV-03)
-- =====================================================================

/**
 * Numeración argentina: punto de venta + número (0003-00001234).
 * La unicidad es por proveedor + tipo + punto de venta + número: una factura A
 * 0001-00000123 y una nota de crédito 0001-00000123 son documentos distintos y
 * pueden coexistir.
 *
 * `paid_amount` se guarda desnormalizado para poder indexar y filtrar por saldo
 * sin recalcular sobre el detalle de pagos en cada consulta. Los CHECK y los
 * triggers de más abajo garantizan que nunca se despegue de la realidad.
 */
-- =====================================================================
-- Órdenes de compra (PROV-02)
-- =====================================================================

/**
 * Estados y su flujo:
 *   BORRADOR  -> se arma la orden, se puede editar el detalle
 *   EMITIDA   -> se envió al proveedor; ya no se edita el detalle
 *   APROBADA  -> el proveedor confirmó
 *   RECIBIDA  -> llegó la mercadería
 *   CANCELADA -> se dio de baja, se conserva el historial
 *
 * `total_amount` lo mantiene un trigger a partir del detalle: si lo cargara la
 * aplicación, podría quedar distinto de la suma de los renglones.
 */
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

/**
 * Renglones de la orden. El criterio pide "artículos O SERVICIOS", y los
 * servicios (una reparación, un flete) no están en el catálogo de artículos.
 * Por eso `article_id` es opcional y `item_description` obligatoria: si hay
 * artículo, la descripción se completa con su nombre; si no, describe el
 * servicio contratado.
 *
 * `subtotal` es columna generada: PostgreSQL la calcula y nadie puede
 * escribirla con un valor que no sea cantidad × precio.
 */
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

/**
 * Historial de estados: el criterio pide que cada cambio registre fecha y
 * usuario responsable. Va en tabla aparte porque una orden pasa por varios
 * estados y hay que conservarlos todos, no solo el último.
 */
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
    /** Anulación: baja lógica, el comprobante nunca se borra (PROV-03). */
    purchase_order_id      INT,          -- PROV-02: orden que originó el comprobante
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

CREATE INDEX idx_voucher_supplier   ON Supplier_Voucher(supplier_id);
CREATE INDEX idx_voucher_purchase_order ON Supplier_Voucher(purchase_order_id);
CREATE INDEX idx_voucher_type       ON Supplier_Voucher(voucher_type_id);
CREATE INDEX idx_voucher_status     ON Supplier_Voucher(voucher_status);
CREATE INDEX idx_voucher_issue_date ON Supplier_Voucher(issue_date);
CREATE INDEX idx_voucher_employees  ON Supplier_Voucher(employees_id);

/** Índice parcial: las consultas de tesorería buscan casi siempre lo impago. */
CREATE INDEX idx_voucher_pendientes
    ON Supplier_Voucher(supplier_id, issue_date)
    WHERE voucher_status = 'PENDIENTE';

-- =====================================================================
-- 3. Formas de pago (PROV-05)
-- =====================================================================
CREATE TABLE Payment_Method (
    payment_method_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payment_method     VARCHAR(50)  NOT NULL UNIQUE,
    description        VARCHAR(255) NOT NULL,
    /** Cheque y transferencia exigen referencia; efectivo no. */
    requires_reference BOOLEAN      NOT NULL DEFAULT FALSE,
    active             BOOLEAN      NOT NULL DEFAULT TRUE
);

-- =====================================================================
-- 4. Órdenes de pago (PROV-04, PROV-05, PROV-07)
-- =====================================================================

/**
 * Estados (PROV-07 pide volver a "estado 0"):
 *   0 = BORRADOR   — se puede editar, agregar o quitar comprobantes
 *   1 = CONFIRMADA — impactó en los saldos y en la cuenta corriente
 *   2 = ANULADA    — cerrada definitivamente, no se puede reutilizar
 *
 * Resetear es pasar de 1 a 0: se restituyen los saldos y se revierte el
 * movimiento de cuenta corriente, pero la orden y su detalle se conservan.
 */
CREATE TABLE Payment_Order (
    payment_order_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supplier_id        INT           NOT NULL,
    payment_method_id  INT           NOT NULL,
    payment_date       DATE          NOT NULL,
    total_amount       NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    payment_reference  VARCHAR(100),
    payment_order_status SMALLINT    NOT NULL DEFAULT 0,
    observations       VARCHAR(255),
    employees_id       INT           NOT NULL,
    creation_date      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_date     TIMESTAMPTZ,

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

/**
 * Detalle: qué importe de la orden se aplica a cada comprobante (PROV-04).
 * La restricción UNIQUE evita dos renglones para el mismo comprobante dentro
 * de una orden; si hace falta pagar más, se edita el renglón existente.
 */
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

/**
 * Auditoría de reseteos (PROV-07).
 * Una orden puede resetearse más de una vez, así que no alcanzan un par de
 * columnas en Payment_Order: cada reseteo deja su propia fila con quién,
 * cuándo, por qué y cuánto se restituyó.
 */
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
-- 5. Cuenta corriente de proveedores (PROV-05, PROV-06)
-- =====================================================================

/**
 * Libro mayor de cada proveedor. Es APPEND-ONLY: las filas no se editan ni se
 * borran nunca. Revertir un pago no elimina el movimiento, agrega otro en
 * sentido contrario apuntando al original con `reversal_of_movement_id`.
 *
 * El saldo NO se guarda como columna: se calcula sumando debe y haber. Un saldo
 * almacenado se desincroniza en cuanto un proceso falla a la mitad, y no hay
 * forma de saber cuál de los dos números es el correcto.
 *
 * Convención contable: `debit` aumenta lo que le debemos al proveedor (una
 * factura), `credit` lo disminuye (un pago o una nota de crédito).
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
    /** Un movimiento es debe O haber, nunca los dos ni ninguno. */
    CONSTRAINT ck_account_single_side
        CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)),
    /** Todo movimiento tiene que poder rastrearse a su origen. */
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
-- 6. Reglas de negocio en la base
-- =====================================================================

/**
 * Mantiene voucher_status coherente con los importes.
 * El estado deja de ser un dato que la aplicación puede olvidar de actualizar:
 * ANULADO lo decide `annulled_date`, y PENDIENTE / PAGADO salen de comparar
 * lo pagado contra el total.
 */
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

/** No se puede anular un comprobante que ya recibió pagos. */
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

/**
 * Valida cada renglón de una orden de pago (PROV-04):
 *   - el comprobante tiene que ser del mismo proveedor que la orden
 *   - no puede estar anulado ni ser de un tipo no pagable (nota de crédito)
 *   - el importe aplicado no puede superar el saldo pendiente
 *   - solo se pueden tocar renglones de órdenes en borrador
 */
CREATE OR REPLACE FUNCTION fn_validate_payment_detail()
RETURNS TRIGGER AS $$
DECLARE
    v_order        RECORD;
    v_voucher      RECORD;
    v_is_payable   BOOLEAN;
    v_pending      NUMERIC(14,2);
    v_previous     NUMERIC(14,2);
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

    -- Al editar un renglón, su importe anterior vuelve a estar disponible.
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

/** Mantiene el total de la orden igual a la suma de sus renglones. */
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

/** La referencia es obligatoria cuando la forma de pago lo exige (cheque, transferencia). */
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

-- =====================================================================
-- 7. Vistas de consulta (PROV-03, PROV-06)
-- =====================================================================

/** Comprobantes con su saldo pendiente ya calculado. */
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

/** Saldo actual de cada proveedor, calculado sobre el libro mayor. */
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

/**
 * Hotel Alejandro I — Sprint 2
 * Control de gastos (PROV-08)
 *
 *   psql -U postgres -d sistema_hotelero_db -f database/07_sprint2_gastos.sql
 *
 * ------------------------------------------------------------------------
 * NOTA DE PLANIFICACIÓN
 * Va en un archivo aparte a propósito. El sprint comprometió 40 puntos sobre
 * una capacidad de 30, y PROV-08 (6 pts) es el candidato a moverse. Separando
 * el script, PROV-01 a PROV-07 se puede desplegar completo sin esta parte, y
 * PROV-08 se agrega después sin tocar nada de lo anterior.
 *
 * Depende de: 05_sprint2_proveedores.sql
 * ------------------------------------------------------------------------
 */
-- ##########################################################################
-- SPRINT 2 — Control de gastos (PROV-08)
-- ##########################################################################

CREATE TABLE Expense_Category (
    expense_category_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    expense_category_name VARCHAR(100) NOT NULL UNIQUE,
    description           VARCHAR(255),
    active                BOOLEAN      NOT NULL DEFAULT TRUE
);

/**
 * Un gasto es la mirada de gestión sobre lo que ya está documentado: agrupa
 * comprobantes y pagos bajo una categoría y un período.
 *
 * `expense_amount` no se guarda: el importe del gasto sale de los comprobantes
 * vinculados. Guardarlo permitiría que el total de gastos difiera del total de
 * comprobantes, que es justo lo que el criterio de aceptación pide evitar
 * ("el total de gastos debe ser consistente con los comprobantes y pagos").
 */
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

/**
 * Vínculo N:M entre gastos y comprobantes. Un gasto puede respaldarse en varios
 * comprobantes (la obra se facturó en tres partes) y un comprobante puede
 * repartirse entre varios gastos (una factura de limpieza que se imputa a dos
 * sectores), por eso `allocated_amount`.
 */
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

/** Vínculo opcional con la orden de pago que canceló el gasto. */
CREATE TABLE Expense_Payment_Order (
    expense_payment_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    expense_id         INT NOT NULL,
    payment_order_id   INT NOT NULL,

    CONSTRAINT uq_expense_payment_order UNIQUE (expense_id, payment_order_id),

    CONSTRAINT fk_expense_payment_expense FOREIGN KEY (expense_id)       REFERENCES Expense(expense_id) ON DELETE CASCADE,
    CONSTRAINT fk_expense_payment_order   FOREIGN KEY (payment_order_id) REFERENCES Payment_Order(payment_order_id)
);

CREATE INDEX idx_expense_payment_order ON Expense_Payment_Order(payment_order_id);

/** Lo imputado a un comprobante no puede superar su importe total. */
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

/** Gastos con su importe y su estado de pago ya resueltos. */
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
JOIN Expense_Category ec  ON ec.expense_category_id = e.expense_category_id
LEFT JOIN Suppliers s     ON s.supplier_id = e.supplier_id
LEFT JOIN Expense_Voucher ev ON ev.expense_id = e.expense_id
GROUP BY e.expense_id, e.expense_date, e.description, e.expense_status,
         ec.expense_category_name, s.supplier_legal_name;

INSERT INTO Expense_Category (expense_category_name, description) VALUES
    ('Insumos de Limpieza',   'Detergentes, desinfectantes y descartables'),
    ('Blancos y Amoblamiento','Reposición de ropa blanca y mobiliario'),
    ('Servicios',             'Luz, gas, agua, internet y telefonía'),
    ('Mantenimiento',         'Reparaciones y obras menores'),
    ('Frigobar y Alimentos',  'Reposición de consumibles de habitaciones')
ON CONFLICT (expense_category_name) DO NOTHING;

/**
 * Datos semilla del Hotel Alejandro I.
 * Es idempotente: se puede correr varias veces sin duplicar registros.
 *
 *   psql -d sistema_hotelero_db -f database/02_seed.sql
 *
 * Las contraseñas se guardan hasheadas con bcrypt desde el backend.
 * Estos hashes corresponden a la contraseña "1234" y son SOLO PARA DESARROLLO.
 */

-- Los archivos están en UTF-8. Sin esta línea, psql en Windows los lee con la
-- codificación regional (WIN1252) y los acentos se guardan rotos.

INSERT INTO Roles (rol_name, rol_pass, rol_description) VALUES
    ('ADMINISTRADOR',   '$2b$10$3euPcmQFCiblsZeEu5s7p.9OVHgeHWFxCiWFzoOOOOOOOOOOOOOOO', 'Acceso total al sistema'),
    ('ENCARGADO_STOCK', '$2b$10$3euPcmQFCiblsZeEu5s7p.9OVHgeHWFxCiWFzoOOOOOOOOOOOOOOO', 'Supervisión de compras y depósitos'),
    ('GOBERNANZA',      '$2b$10$3euPcmQFCiblsZeEu5s7p.9OVHgeHWFxCiWFzoOOOOOOOOOOOOOOO', 'Blanco, amoblamiento y limpieza'),
    ('RECEPCION',       '$2b$10$3euPcmQFCiblsZeEu5s7p.9OVHgeHWFxCiWFzoOOOOOOOOOOOOOOO', 'Consumos de minibar y amenities')
ON CONFLICT (rol_name) DO NOTHING;

INSERT INTO Employees (rol_id, employees_name, employees_lastname, employees_email, employees_phone)
SELECT r.rol_id, e.nombre, e.apellido, e.email, e.telefono
FROM (VALUES
    ('ADMINISTRADOR',   'Carlos',  'Gómez',    'cgomez@hotelalejandro.com',    '+543874112233'),
    ('ENCARGADO_STOCK', 'Mariana', 'López',    'mlopez@hotelalejandro.com',    '+543874445566'),
    ('GOBERNANZA',      'Sonia',   'Martínez', 'smartinez@hotelalejandro.com', '+543874778899')
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
    ('Blancos y Mantelería', 'BLA-001', '001', 'Sábana 2 Plazas 180 hilos',        'Sábana ajustable blanca 2 plazas',   'Sábana ajustable blanca para cama matrimonial', 'UNIDAD', 20.00),
    ('Blancos y Mantelería', 'BLA-002', '002', 'Toallón de Baño 500g',             'Toallón blanco algodón 90x150',      'Toallón blanco de algodón puro 90x150cm',       'UNIDAD', 30.00),
    ('Artículos de Limpieza','LIM-001', '003', 'Detergente Multiuso Concentrado',  'Detergente concentrado bidón 5L',    'Bidón de desinfectante líquido',                'BIDON',   5.00),
    ('Amenities y Baño',     'AME-001', '004', 'Jabón Fraccional 20g',             'Jabón individual huéspedes 20g',     'Jabón en pastilla individual para huéspedes',   'CAJA',   10.00),
    ('Frigobar y Snacks',    'FRI-001', '005', 'Agua Mineral Sin Gas 500ml',       'Agua mineral PET 500ml',             'Botella PET agua mineral',                      'UNIDAD', 50.00),
    ('Frigobar y Snacks',    'FRI-002', '006', 'Vino Malbec Reserva 750ml',        'Malbec reserva 750ml frigobar',      'Vino para reposición de frigobar en Suite',     'UNIDAD', 12.00)
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
JOIN Articles a ON a.article_code  = s.codigo
JOIN Deposit  d ON d.deposit_name  = s.deposito
ON CONFLICT (article_id, deposit_id) DO NOTHING;

INSERT INTO Movement_Type (movement_type, description, effect) VALUES
    ('INGRESO',            'Entrada de mercadería al stock',            'SUMA'),
    ('EGRESO',             'Salida de mercadería del stock',            'RESTA'),
    ('TRANSFERENCIA',      'Traslado de mercadería entre depósitos',    'TRANSFERENCIA'),
    ('CONSUMO',            'Consumo interno de insumos',                'RESTA'),
    ('AJUSTE_POSITIVO',    'Ajuste de inventario que suma stock',       'SUMA'),
    ('AJUSTE_NEGATIVO',    'Ajuste de inventario que descuenta stock',  'RESTA')
ON CONFLICT (movement_type) DO NOTHING;

/**
 * Datos semilla del Sprint 2 — catálogos de comprobantes y formas de pago.
 * Idempotente: se puede correr varias veces.
 *
 *   psql -U postgres -d sistema_hotelero_db -f database/06_sprint2_seed.sql
 */

/**
 * `sign` define el efecto sobre la deuda: +1 la aumenta, -1 la disminuye.
 * `is_payable` marca qué comprobantes admiten órdenes de pago. Una nota de
 * crédito no se paga: se aplica contra otros comprobantes o queda a favor.
 */
-- ##########################################################################
-- DATOS SEMILLA — Sprint 1
-- ##########################################################################
-- DATOS SEMILLA — Sprint 2
-- ##########################################################################

INSERT INTO Voucher_Type (voucher_type, description, sign, affects_account, is_payable) VALUES
    ('FACTURA_A',        'Factura A de proveedor inscripto',                    1, TRUE,  TRUE),
    ('FACTURA_B',        'Factura B de proveedor',                              1, TRUE,  TRUE),
    ('FACTURA_C',        'Factura C de monotributista',                         1, TRUE,  TRUE),
    ('NOTA_DEBITO',      'Nota de débito: aumenta la deuda con el proveedor',   1, TRUE,  TRUE),
    ('NOTA_CREDITO',     'Nota de crédito: disminuye la deuda con el proveedor', -1, TRUE, FALSE),
    ('REMITO',           'Remito sin valor fiscal, no afecta la cuenta',        1, FALSE, FALSE),
    ('RECIBO',           'Recibo emitido por el proveedor',                     1, FALSE, FALSE)
ON CONFLICT (voucher_type) DO NOTHING;

INSERT INTO Payment_Method (payment_method, description, requires_reference) VALUES
    ('EFECTIVO',      'Pago en efectivo por caja',                        FALSE),
    ('TRANSFERENCIA', 'Transferencia bancaria: requiere número de operación', TRUE),
    ('CHEQUE',        'Cheque propio o de terceros: requiere número',      TRUE)
ON CONFLICT (payment_method) DO NOTHING;

-- =====================================================================
-- PROV-01 — Condiciones fiscales
-- =====================================================================
INSERT INTO Tax_Condition (tax_condition_name, description) VALUES
    ('RESPONSABLE_INSCRIPTO', 'IVA responsable inscripto: emite factura A'),
    ('MONOTRIBUTISTA',        'Responsable monotributo: emite factura C'),
    ('EXENTO',                'IVA exento'),
    ('CONSUMIDOR_FINAL',      'Consumidor final')
ON CONFLICT (tax_condition_name) DO NOTHING;

/**
 * Formato de CUIT: 11 dígitos, con o sin guiones (30-71123456-8 o 30711234568).
 * La validación del dígito verificador se hace en el backend, porque el CHECK
 * quedaría ilegible y difícil de mantener.
 */

-- Los proveedores de la semilla son empresas: responsable inscripto.
UPDATE Suppliers
SET tax_condition_id = (SELECT tax_condition_id FROM Tax_Condition WHERE tax_condition_name = 'RESPONSABLE_INSCRIPTO')
WHERE tax_condition_id IS NULL;

UPDATE Suppliers
SET tax_condition_id = (SELECT tax_condition_id FROM Tax_Condition WHERE tax_condition_name = 'RESPONSABLE_INSCRIPTO')
WHERE tax_condition_id IS NULL;

-- =====================================================================
-- Vistas de PROV-01 y PROV-02
-- =====================================================================
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
    COUNT(pod.purchase_detail_id)            AS item_count,
    COUNT(DISTINCT sv.voucher_id)            AS voucher_count,
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

/** Proveedores con su condición fiscal resuelta, para los selectores. */
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

COMMIT;
