-- Registro de acompañantes en check-in, servicios y cargos asociados al folio de habitación.
BEGIN;

CREATE TABLE IF NOT EXISTS Reservation_Stay_Guest (
    stay_guest_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reservation_id INT NOT NULL REFERENCES Reservation(reservation_id),
    guest_role VARCHAR(20) NOT NULL CHECK (guest_role IN ('TITULAR', 'ACOMPANANTE')),
    person_type VARCHAR(10) NOT NULL CHECK (person_type IN ('ADULTO', 'MENOR')),
    document_type VARCHAR(20) NOT NULL,
    document_number VARCHAR(30) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    employees_id INT NOT NULL REFERENCES Employees(employees_id),
    CONSTRAINT uq_stay_guest_document UNIQUE (reservation_id, document_type, document_number)
);
CREATE INDEX IF NOT EXISTS idx_stay_guest_reservation ON Reservation_Stay_Guest(reservation_id);

CREATE TABLE IF NOT EXISTS Room_Service_Catalog (
    service_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    current_price NUMERIC(14,2) NOT NULL CHECK (current_price > 0),
    currency CHAR(3) NOT NULL DEFAULT 'ARS',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INT NOT NULL REFERENCES Employees(employees_id)
);

CREATE TABLE IF NOT EXISTS Room_Service_Price_History (
    price_history_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    service_id INT NOT NULL REFERENCES Room_Service_Catalog(service_id),
    previous_price NUMERIC(14,2),
    new_price NUMERIC(14,2) NOT NULL CHECK (new_price > 0),
    valid_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    employees_id INT NOT NULL REFERENCES Employees(employees_id)
);
CREATE INDEX IF NOT EXISTS idx_service_price_history ON Room_Service_Price_History(service_id, valid_from DESC);

CREATE TABLE IF NOT EXISTS Room_Service_Charge (
    charge_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reservation_id INT NOT NULL REFERENCES Reservation(reservation_id),
    room_id INT NOT NULL REFERENCES Room(room_id),
    service_id INT NOT NULL REFERENCES Room_Service_Catalog(service_id),
    service_name VARCHAR(100) NOT NULL,
    quantity SMALLINT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price > 0),
    total_amount NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    charged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    employees_id INT NOT NULL REFERENCES Employees(employees_id),
    paid_at TIMESTAMPTZ,
    paid_by INT REFERENCES Employees(employees_id),
    CONSTRAINT ck_room_service_paid_by CHECK ((paid_at IS NULL) = (paid_by IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_room_service_charge_stay ON Room_Service_Charge(reservation_id, charged_at);

COMMIT;
