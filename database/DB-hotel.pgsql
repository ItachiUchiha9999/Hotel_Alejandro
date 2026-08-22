/**
DB Sistema Hotelero Alejandro (V1.0)
PostgreSQL version 17.10-2
**/

-- Extensión para UUIDs y Encriptación de Contraseñas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================
-- 1. Tipos de datos
-- ==================

CREATE TYPE type_operation_enum AS ENUM(
    'INGRESO',
    'EGRESO',
    'TRANSFERENCIA',
    'CONSUMO'
);

-- =======================
-- 2. Seguridad y Usuarios
-- =======================
CREATE TABLE Roles(
    rol_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rol_name VARCHAR(50) NOT NULL UNIQUE,
    rol_pass TEXT NOT NULL,
    rol_description VARCHAR(255),
    rol_state BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE Employees(
    employees_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rol_id INT NOT NULL,
    employees_name VARCHAR(100) NOT NULL,
    employees_lastname VARCHAR(100) NOT NULL,
    employees_email VARCHAR(150) NOT NULL UNIQUE,
    employees_phone VARCHAR(30) NOT NULL,
    employees_state BOOLEAN NOT NULL DEFAULT TRUE,
    creation_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_employees_rol FOREIGN KEY (rol_id) REFERENCES Roles(rol_id)
);

-- =======================
-- 3. Proveedores
-- =======================
CREATE TABLE Suppliers(
    supplier_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supplier_legal_name VARCHAR(150) NOT NULL,
    supplier_trade_name VARCHAR(150),
    supplier_cuit VARCHAR(13) NOT NULL UNIQUE,
    supplier_email VARCHAR(150),
    supplier_phone VARCHAR(30),
    supplier_address VARCHAR(200),
    supplier_state BOOLEAN NOT NULL DEFAULT TRUE,
    creation_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==========================
-- 4. Categorías y Artículos
-- ==========================
CREATE TABLE Categories(
    category_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    category_description VARCHAR(200),
    category_state BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE Articles(
    article_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id INT NOT NULL,
    article_code VARCHAR(50) NOT NULL UNIQUE,
    article_name VARCHAR(150) NOT NULL,
    article_description VARCHAR(255),
    article_unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'UNIDAD', -- Unidad/kg/litro/caja
    article_stock_min_general NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    article_state BOOLEAN NOT NULL DEFAULT TRUE,
    creation_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_article_categories FOREIGN KEY (category_id) REFERENCES Categories(category_id)
);

-- ==========================
-- 5. Depósito y Stock
-- ==========================

CREATE TABLE Deposit(
    deposit_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    deposit_name VARCHAR(100) NOT NULL UNIQUE,
    deposit_location VARCHAR(150),
    deposit_state BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE Articles_Deposit_Stock(
    stock_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    article_id INT NOT NULL,
    deposit_id INT NOT NULL,
    stock_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    update_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_stock_no_negative CHECK (stock_amount >= 0),
    CONSTRAINT uq_article_deposit UNIQUE (article_id, deposit_id),
    CONSTRAINT fk_stock_article FOREIGN KEY (article_id) REFERENCES Articles(article_id),
    CONSTRAINT fk_stock_deposit FOREIGN KEY (deposit_id) REFERENCES Deposit(deposit_id)
);

-- ================================================
-- 6. Movimientos de Stock (c/Cabecera y Detalles)
-- ================================================

CREATE TABLE Stock_Movement(
    stock_movement_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stock_movement_operation_type type_operation_enum NOT NULL,
    deposit_origin_id INT NOT NULL,
    deposit_destination_id INT, -- NULL para consumo o egreso directo
    employees_id INT NOT NULL,
    supplier_id INT,
    observations VARCHAR(255),
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_stock_movement_origin FOREIGN KEY (deposit_origin_id) REFERENCES Deposit(deposit_id),
    CONSTRAINT fk_stock_movement_destination FOREIGN KEY (deposit_destination_id) REFERENCES Deposit(deposit_id),
    CONSTRAINT fk_movement_employees FOREIGN KEY (employees_id) REFERENCES Employees(employees_id),
    CONSTRAINT fk_movement_supplier FOREIGN KEY (supplier_id) REFERENCES Suppliers(supplier_id)
);

CREATE TABLE Movement_Stock_Detail(
    Detail_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stock_movement_id INT NOT NULL,
    article_id INT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    
    CONSTRAINT ck_detail_amount_positive CHECK (amount > 0),
    CONSTRAINT uq_movement_article UNIQUE (stock_movement_id, article_id),
    CONSTRAINT fk_detail_movement FOREIGN KEY (stock_movement_id) REFERENCES Stock_Movement(stock_movement_id) ON DELETE CASCADE,
    CONSTRAINT fk_detail_article FOREIGN KEY (article_id) REFERENCES Articles(article_id)
);

-- ===========================
-- 7. Índices de Rendimiento
-- ===========================
CREATE INDEX idx_articles_category ON Articles(category_id);
CREATE INDEX idx_stock_articles_deposit ON Articles_Deposit_Stock(article_id, deposit_id);
CREATE INDEX idx_movement_date ON Stock_Movement(transaction_date);
CREATE INDEX idx_movement_origin ON Stock_Movement(deposit_origin_id);

-- ============================================================
-- 8. DATOS SEMILLA (HOTEL ALEJANDRO)
-- ============================================================

-- Roles
INSERT INTO Roles (rol_name, rol_pass, rol_description)
VALUES 
    ('ADMINISTRADOR', crypt('1234admin', gen_salt('bf')), 'Acceso total al sistema del hotel'),
    ('ENCARGADO_STOCK', crypt('stock2026', gen_salt('bf')), 'Supervisión de compras y depósitos'),
    ('GOBERNANZA', crypt('limpieza123', gen_salt('bf')), 'Gestión de blanco, amoblamiento y limpieza'),
    ('RECEPCION', crypt('recepcion123', gen_salt('bf')), 'Control de consumos de minibar y amenitíes');

-- Empleados
INSERT INTO Employees (rol_id, employees_name, employees_lastname, employees_email, employees_phone)
VALUES 
    (1, 'Carlos', 'Gómez', 'cgomez@hotelalejandro.com', '+543874112233'),
    (2, 'Mariana', 'López', 'mlopez@hotelalejandro.com', '+543874445566'),
    (3, 'Sonia', 'Martínez', 'smartinez@hotelalejandro.com', '+543874778899');

-- Proveedores
INSERT INTO Suppliers (supplier_legal_name, supplier_trade_name, supplier_cuit, supplier_email, supplier_phone, supplier_address)
VALUES 
    ('Distribuidora Textil del Norte S.A.', 'Textil Norte', '30-71123456-8', 'ventas@textilnorte.com', '0387-4311000', 'Av. Chile 1450, Salta'),
    ('Química Salteña S.R.L.', 'Química Salta', '30-65498732-1', 'contacto@quimicasalta.com', '0387-4223344', 'Av. Tavella 2800, Salta'),
    ('Bebidas y Alimentos S.A.', 'Bebidas NOA', '30-58963214-5', 'pedidos@bebidasnoa.com', '0387-4950011', 'Ruta 68 Km 5, Cerrillos');

-- Categorías
INSERT INTO Categories (category_name, category_description)
VALUES 
    ('Blancos y Mantelería', 'Toallas, sábanas, fundas, manteles y servilletas'),
    ('Artículos de Limpieza', 'Detergentes, desinfectantes, lavandina, escobas'),
    ('Amenitíes y Baño', 'Jabones, champú, acondicionador, gorros de ducha'),
    ('Frigobar y Snacks', 'Aguas, gaseosas, vinos, chocolates y frutos secos');

-- Artículos
INSERT INTO Articles (category_id, article_code, article_name, article_description, article_unit_of_measure, article_stock_min_general)
VALUES 
    (1, 'BLA-001', 'Sábana 2 Plazas 180 hilos', 'Sábana ajustable blanca para cama matrimonial', 'UNIDAD', 20.00),
    (1, 'BLA-002', 'Toallón de Baño 500g', 'Toallón blanco de algodón puro 90x150cm', 'UNIDAD', 30.00),
    (2, 'LIM-001', 'Detergente Multiuso Concentrado', 'Bidón de lavandina/desinfectante líquido', 'BIDON', 5.00),
    (3, 'AME-001', 'Jabón Fraccional 20g', 'Jabón en pastilla individual para huéspedes', 'CAJA', 10.00),
    (4, 'FRI-001', 'Agua Mineral Sin Gas 500ml', 'Botella PET agua mineral', 'UNIDAD', 50.00),
    (4, 'FRI-002', 'Vino Malbec Reserva 750ml', 'Vino para reposición de frigobar en Suite', 'UNIDAD', 12.00);

-- Depósitos
INSERT INTO Deposit (deposit_name, deposit_location)
VALUES 
    ('Depósito Central', 'Subsuelo - Sector Compras'),
    ('Office Gobernanza Piso 1', 'Piso 1 - Pasillo Central'),
    ('Office Gobernanza Piso 2', 'Piso 2 - Pasillo Central'),
    ('Depósito Resto Bar / Frigobar', 'Planta Baja - Cocina Principal');

-- Stock Inicial por Depósito
INSERT INTO Articles_Deposit_Stock (article_id, deposit_id, stock_amount)
VALUES 
    (1, 1, 100.00), -- 100 sábanas en Depósito Central
    (2, 1, 150.00), -- 150 toallones en Depósito Central
    (2, 2, 20.00),  -- 20 toallones en Office Piso 1
    (3, 1, 15.00),  -- 15 bidones detergente en Depósito Central
    (4, 1, 25.00),  -- 25 cajas amenitíes en Depósito Central
    (5, 4, 120.00), -- 120 aguas en Depósito Frigobar
    (6, 4, 30.00);  -- 30 vinos en Depósito Frigobar

-- Movimiento de Ejemplo 1: INGRESO de Agua Mineral desde Proveedor
INSERT INTO Stock_Movement (stock_movement_operation_type, deposit_origin_id, employees_id, supplier_id, observations)
VALUES ('INGRESO', 4, 2, 3, 'Compra de reposición mensual de bebidas según Factura A-000123');

INSERT INTO Movement_Stock_Detail (stock_movement_id, article_id, amount)
VALUES (1, 5, 120.00);

-- Movimiento de Ejemplo 2: TRANSFERENCIA de Toallones del Depósito Central al Office Piso 1
INSERT INTO Stock_Movement (stock_movement_operation_type, deposit_origin_id, deposit_destination_id, employees_id, observations)
VALUES ('TRANSFERENCIA', 1, 2, 3, 'Transferencia para stock de ropa blanca diaria');

INSERT INTO Movement_Stock_Detail (stock_movement_id, article_id, amount)
VALUES (2, 2, 20.00);

-- ================================================
-- Modificación de Movement_Stock_Detail
-- Permite valores NULL temporalmente
-- ================================================

-- 1. Eliminar el constraint UNIQUE actual
ALTER TABLE Movement_Stock_Detail 
DROP CONSTRAINT IF EXISTS uq_movement_article;

-- 2. Eliminar la Foreign Key actual que apunta a Articles
ALTER TABLE Movement_Stock_Detail 
DROP CONSTRAINT IF EXISTS fk_detail_article;

-- 3. Eliminar la columna article_id
ALTER TABLE Movement_Stock_Detail 
DROP COLUMN IF EXISTS article_id;

-- 4. Agregar la nueva columna stock_id (PERMITE NULL temporalmente)
ALTER TABLE Movement_Stock_Detail 
ADD COLUMN stock_id INT;

-- 5. Agregar el nuevo constraint UNIQUE
ALTER TABLE Movement_Stock_Detail 
ADD CONSTRAINT uq_movement_stock UNIQUE (stock_movement_id, stock_id);

-- 6. Agregar la nueva Foreign Key que apunta a Articles_Deposit_Stock
ALTER TABLE Movement_Stock_Detail 
ADD CONSTRAINT fk_detail_stock 
FOREIGN KEY (stock_id) REFERENCES Articles_Deposit_Stock(stock_id);