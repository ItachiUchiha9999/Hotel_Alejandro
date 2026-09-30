-- Sprint 3 — HAB-03 (catalogo de tipos de habitacion) y HAB-01 (registrar habitacion).
-- Ejecutar despues de DB-hotel.pgsql sobre una base existente:
--   psql -U postgres -d sistema_hotelero_db -f database/09_hab01_hab03_habitaciones.sql
-- Es idempotente: se puede correr mas de una vez sin duplicar nada.

-- ---------------------------------------------------------------------------
-- HAB-03 — Tipos de habitacion
-- Un tipo inactivo no se ofrece al registrar habitaciones nuevas, pero las que
-- ya lo tienen asignado siguen existiendo (baja logica).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS room_type (
    room_type_id           SERIAL PRIMARY KEY,
    room_type_name         VARCHAR(60)  NOT NULL,
    room_type_description  VARCHAR(255),
    room_type_max_capacity SMALLINT     NOT NULL DEFAULT 1,
    room_type_state        BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_room_type_name UNIQUE (room_type_name),
    CONSTRAINT ck_room_type_capacity CHECK (room_type_max_capacity BETWEEN 1 AND 20),
    CONSTRAINT ck_room_type_name CHECK (LENGTH(TRIM(room_type_name)) >= 2)
);

-- "Suite" y "suite" son el mismo tipo para el hotel: el indice unico por
-- LOWER() lo garantiza aunque alguien escriba directo en la base.
CREATE UNIQUE INDEX IF NOT EXISTS uq_room_type_name_ci
    ON room_type (LOWER(room_type_name));

-- ---------------------------------------------------------------------------
-- HAB-01 — Habitaciones
-- room_state arranca siempre en DISPONIBLE; los otros dos valores los usaran
-- las historias siguientes del sprint (ocupacion y mantenimiento).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS room (
    room_id      SERIAL PRIMARY KEY,
    room_number  VARCHAR(10) NOT NULL,
    room_type_id INTEGER     NOT NULL,
    room_state   VARCHAR(20) NOT NULL DEFAULT 'DISPONIBLE',
    CONSTRAINT uq_room_number UNIQUE (room_number),
    CONSTRAINT ck_room_state CHECK (room_state IN ('DISPONIBLE', 'OCUPADA', 'MANTENIMIENTO')),
    CONSTRAINT fk_room_room_type FOREIGN KEY (room_type_id)
        REFERENCES room_type (room_type_id)
);

CREATE INDEX IF NOT EXISTS idx_room_room_type ON room (room_type_id);
CREATE INDEX IF NOT EXISTS idx_room_state ON room (room_state);

-- ---------------------------------------------------------------------------
-- Datos iniciales: los tres tipos base del hotel.
-- ---------------------------------------------------------------------------
INSERT INTO room_type (room_type_name, room_type_description, room_type_max_capacity, room_type_state)
VALUES
    ('Simple', 'Habitacion individual con cama de una plaza.', 1, TRUE),
    ('Doble',  'Habitacion con cama matrimonial o dos camas individuales.', 2, TRUE),
    ('Suite',  'Suite con dormitorio y living integrado.', 4, TRUE)
ON CONFLICT (room_type_name) DO NOTHING;
