-- Soporte de gastos operativos vinculados a comprobantes y órdenes de pago.
-- Los egresos del reporte se originan únicamente en órdenes confirmadas.
BEGIN;

CREATE TABLE IF NOT EXISTS expense_category (
  expense_category_id SERIAL PRIMARY KEY,
  expense_category_name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS expense (
  expense_id SERIAL PRIMARY KEY,
  expense_category_id INTEGER NOT NULL,
  supplier_id INTEGER,
  expense_date DATE NOT NULL,
  description VARCHAR(255) NOT NULL,
  expense_status VARCHAR(20) NOT NULL DEFAULT 'REGISTRADO',
  employees_id INTEGER NOT NULL,
  creation_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_expense_category FOREIGN KEY (expense_category_id)
    REFERENCES expense_category(expense_category_id),
  CONSTRAINT fk_expense_supplier FOREIGN KEY (supplier_id)
    REFERENCES suppliers(supplier_id),
  CONSTRAINT fk_expense_employee FOREIGN KEY (employees_id)
    REFERENCES employees(employees_id)
);

CREATE TABLE IF NOT EXISTS expense_voucher (
  expense_voucher_id SERIAL PRIMARY KEY,
  expense_id INTEGER NOT NULL,
  voucher_id INTEGER NOT NULL,
  allocated_amount NUMERIC(14, 2) NOT NULL,
  CONSTRAINT fk_expense_voucher_expense FOREIGN KEY (expense_id)
    REFERENCES expense(expense_id) ON DELETE CASCADE,
  CONSTRAINT fk_expense_voucher_voucher FOREIGN KEY (voucher_id)
    REFERENCES supplier_voucher(voucher_id),
  CONSTRAINT uq_expense_voucher UNIQUE (expense_id, voucher_id)
);

CREATE TABLE IF NOT EXISTS expense_payment_order (
  expense_payment_id SERIAL PRIMARY KEY,
  expense_id INTEGER NOT NULL,
  payment_order_id INTEGER NOT NULL,
  CONSTRAINT fk_expense_payment_expense FOREIGN KEY (expense_id)
    REFERENCES expense(expense_id) ON DELETE CASCADE,
  CONSTRAINT fk_expense_payment_order FOREIGN KEY (payment_order_id)
    REFERENCES payment_order(payment_order_id),
  CONSTRAINT uq_expense_payment_order UNIQUE (expense_id, payment_order_id)
);

CREATE INDEX IF NOT EXISTS idx_expense_category ON expense(expense_category_id);
CREATE INDEX IF NOT EXISTS idx_expense_supplier ON expense(supplier_id);
CREATE INDEX IF NOT EXISTS idx_expense_date ON expense(expense_date);
CREATE INDEX IF NOT EXISTS idx_expense_voucher_voucher ON expense_voucher(voucher_id);
CREATE INDEX IF NOT EXISTS idx_expense_payment_order ON expense_payment_order(payment_order_id);

COMMIT;