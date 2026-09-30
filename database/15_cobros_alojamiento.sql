-- Registra pagos parciales/totales del alojamiento para caja y dashboard.
BEGIN;

CREATE TABLE IF NOT EXISTS Reservation_Payment (
    reservation_payment_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reservation_id INT NOT NULL,
    payment_method_id INT NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    paid_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_reference VARCHAR(100),
    employees_id INT NOT NULL,
    CONSTRAINT fk_reservation_payment_reservation FOREIGN KEY (reservation_id) REFERENCES Reservation(reservation_id),
    CONSTRAINT fk_reservation_payment_method FOREIGN KEY (payment_method_id) REFERENCES Payment_Method(payment_method_id),
    CONSTRAINT fk_reservation_payment_employee FOREIGN KEY (employees_id) REFERENCES Employees(employees_id)
);

CREATE INDEX IF NOT EXISTS idx_reservation_payment_date ON Reservation_Payment(paid_at);
CREATE INDEX IF NOT EXISTS idx_reservation_payment_reservation ON Reservation_Payment(reservation_id, paid_at);

COMMIT;
