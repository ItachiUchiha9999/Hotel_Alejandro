-- Reparacion y datos iniciales de PROV-03.
-- Ejecutar despues de DB-hotel.pgsql sobre una base existente.

INSERT INTO Voucher_Type (voucher_type, description, sign, affects_account, is_payable, active)
VALUES
    ('FACTURA', 'Factura recibida del proveedor.', 1, TRUE, TRUE, TRUE),
    ('NOTA_CREDITO', 'Nota de credito recibida del proveedor.', -1, TRUE, FALSE, TRUE),
    ('NOTA_DEBITO', 'Nota de debito recibida del proveedor.', 1, TRUE, TRUE, TRUE)
ON CONFLICT (voucher_type) DO NOTHING;

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
JOIN Suppliers s ON s.supplier_id = sv.supplier_id
JOIN Voucher_Type vt ON vt.voucher_type_id = sv.voucher_type_id;