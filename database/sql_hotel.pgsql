-- ============================================================
-- HOTEL ALEJANDRO
-- MODULO DE STOCK
-- PostgreSQL
-- ============================================================


-- ============================================================
-- 1. TIPOS ENUM
-- ============================================================

CREATE TYPE tipo_movimiento_stock AS ENUM (
    'INGRESO',
    'EGRESO',
    'AJUSTE'
);


-- ============================================================
-- 2. ROLES
-- ============================================================

CREATE TABLE roles (
    rol_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    rol_nombre VARCHAR(100) NOT NULL UNIQUE,

    rol_descripcion VARCHAR(255)
);


-- ============================================================
-- 3. EMPLEADOS
-- ============================================================

CREATE TABLE empleados (
    empleado_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    rol_id INT NOT NULL,

    empleado_nombre VARCHAR(100) NOT NULL,

    empleado_email VARCHAR(150) NOT NULL UNIQUE,

    empleado_descripcion VARCHAR(255),

    empleado_estado BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT fk_empleado_rol
        FOREIGN KEY (rol_id)
        REFERENCES roles(rol_id)
);


-- ============================================================
-- 4. ARTICULOS
-- ============================================================

CREATE TABLE articulos (
    articulo_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    articulo_codigo VARCHAR(50) NOT NULL UNIQUE,

    articulo_numero VARCHAR(50) NOT NULL UNIQUE,

    articulo_nombre VARCHAR(150) NOT NULL,

    articulo_nombre_completo VARCHAR(200),

    articulo_descripcion VARCHAR(255),

    articulo_estado BOOLEAN NOT NULL DEFAULT TRUE
);


-- ============================================================
-- 5. DEPOSITOS
-- ============================================================

CREATE TABLE depositos (
    deposito_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    deposito_nombre VARCHAR(100) NOT NULL UNIQUE,

    deposito_estado BOOLEAN NOT NULL DEFAULT TRUE
);


-- ============================================================
-- 6. TIPOS DE MOVIMIENTO DE STOCK
-- ============================================================

CREATE TABLE tipos_movimiento_stock (
    tipo_mov_stock_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    tipo_mov_stock_descripcion VARCHAR(100) NOT NULL,

    tipo_mov_stock_tipo tipo_movimiento_stock NOT NULL,

    tipo_mov_stock_estado BOOLEAN NOT NULL DEFAULT TRUE
);


-- ============================================================
-- 7. MOVIMIENTOS DE STOCK
-- ============================================================

CREATE TABLE movimientos_stock (
    movimiento_stock_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    deposito_id INT NOT NULL,

    tipo_mov_stock_id INT NOT NULL,

    empleado_id INT NOT NULL,

    fecha_movimiento TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    observaciones VARCHAR(255),

    CONSTRAINT fk_movimiento_stock_deposito
        FOREIGN KEY (deposito_id)
        REFERENCES depositos(deposito_id),

    CONSTRAINT fk_movimiento_stock_tipo
        FOREIGN KEY (tipo_mov_stock_id)
        REFERENCES tipos_movimiento_stock(tipo_mov_stock_id),

    CONSTRAINT fk_movimiento_stock_empleado
        FOREIGN KEY (empleado_id)
        REFERENCES empleados(empleado_id)
);


-- ============================================================
-- 8. DETALLE DE MOVIMIENTOS DE STOCK
-- ============================================================

CREATE TABLE movimientos_stock_detalle (
    movimiento_stock_detalle_id INT
        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    movimiento_stock_id INT NOT NULL,

    articulo_id INT NOT NULL,

    cantidad NUMERIC(12,2) NOT NULL,

    CONSTRAINT ck_movimiento_stock_detalle_cantidad
        CHECK (cantidad > 0),

    CONSTRAINT uq_movimiento_stock_articulo
        UNIQUE (movimiento_stock_id, articulo_id),

    CONSTRAINT fk_movimiento_stock_detalle_movimiento
        FOREIGN KEY (movimiento_stock_id)
        REFERENCES movimientos_stock(movimiento_stock_id),

    CONSTRAINT fk_movimiento_stock_detalle_articulo
        FOREIGN KEY (articulo_id)
        REFERENCES articulos(articulo_id)
);


-- ============================================================
-- 9. STOCK ACTUAL DE ARTICULOS POR DEPOSITO
-- ============================================================

CREATE TABLE articulos_depositos_stock (
    articulo_deposito_stock_id INT
        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    articulo_id INT NOT NULL,

    deposito_id INT NOT NULL,

    stock NUMERIC(12,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT ck_articulo_deposito_stock
        CHECK (stock >= 0),

    CONSTRAINT uq_articulo_deposito
        UNIQUE (articulo_id, deposito_id),

    CONSTRAINT fk_articulo_deposito_articulo
        FOREIGN KEY (articulo_id)
        REFERENCES articulos(articulo_id),

    CONSTRAINT fk_articulo_deposito_deposito
        FOREIGN KEY (deposito_id)
        REFERENCES depositos(deposito_id)
);


-- ============================================================
-- 10. PROVEEDORES
-- ============================================================

CREATE TABLE proveedores (
    proveedor_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    proveedor_nombre VARCHAR(150) NOT NULL,

    razon_social VARCHAR(150) NOT NULL,

    cuit VARCHAR(13) NOT NULL UNIQUE,

    email VARCHAR(150),

    telefono VARCHAR(30),

    categoria VARCHAR(100),

    proveedor_estado BOOLEAN NOT NULL DEFAULT TRUE
);


-- ============================================================
-- INDICES
-- ============================================================

CREATE INDEX idx_movimientos_stock_deposito
    ON movimientos_stock(deposito_id);

CREATE INDEX idx_movimientos_stock_tipo
    ON movimientos_stock(tipo_mov_stock_id);

CREATE INDEX idx_movimientos_stock_empleado
    ON movimientos_stock(empleado_id);

CREATE INDEX idx_movimientos_stock_fecha
    ON movimientos_stock(fecha_movimiento);

CREATE INDEX idx_movimientos_stock_detalle_articulo
    ON movimientos_stock_detalle(articulo_id);

CREATE INDEX idx_articulos_depositos_stock_articulo
    ON articulos_depositos_stock(articulo_id);

CREATE INDEX idx_articulos_depositos_stock_deposito
    ON articulos_depositos_stock(deposito_id);


-- ============================================================
-- DATOS INICIALES
-- ============================================================

INSERT INTO roles (
    rol_nombre,
    rol_descripcion
)
VALUES
    ('ADMINISTRADOR', 'Administrador del sistema'),
    ('ENCARGADO_STOCK', 'Encargado de controlar el stock'),
    ('EMPLEADO', 'Empleado general');


-- ============================================================
-- TIPOS DE MOVIMIENTO
-- ============================================================

INSERT INTO tipos_movimiento_stock (
    tipo_mov_stock_descripcion,
    tipo_mov_stock_tipo
)
VALUES
    ('Ingreso de mercaderia', 'INGRESO'),
    ('Egreso de mercaderia', 'EGRESO'),
    ('Ajuste de inventario', 'AJUSTE');


-- ============================================================
-- DEPOSITOS DE EJEMPLO
-- ============================================================

INSERT INTO depositos (
    deposito_nombre
)
VALUES
    ('Deposito Central'),
    ('Deposito Cocina'),
    ('Deposito Limpieza');