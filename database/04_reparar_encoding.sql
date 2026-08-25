SET client_encoding = 'UTF8';

BEGIN;

CREATE OR REPLACE FUNCTION fn_rep(t TEXT) RETURNS TEXT AS $func$
DECLARE r TEXT;
BEGIN
    IF t IS NULL THEN RETURN NULL; END IF;
    r := convert_from(convert_to(t, 'WIN1252'), 'UTF8');
    RETURN r;
EXCEPTION WHEN OTHERS THEN
    RETURN t;
END;
$func$ LANGUAGE plpgsql;

UPDATE Categories SET category_name = fn_rep(category_name), category_description = fn_rep(category_description);
UPDATE Articles SET article_name = fn_rep(article_name), article_compound_name = fn_rep(article_compound_name), article_description = fn_rep(article_description);
UPDATE Deposit SET deposit_name = fn_rep(deposit_name), deposit_location = fn_rep(deposit_location);
UPDATE Employees SET employees_name = fn_rep(employees_name), employees_lastname = fn_rep(employees_lastname);
UPDATE Suppliers SET supplier_legal_name = fn_rep(supplier_legal_name), supplier_trade_name = fn_rep(supplier_trade_name), supplier_address = fn_rep(supplier_address);
UPDATE Roles SET rol_description = fn_rep(rol_description);
UPDATE Movement_Type SET description = fn_rep(description);
UPDATE Stock_Movement SET observations = fn_rep(observations);

DROP FUNCTION fn_rep(TEXT);

COMMIT;

SELECT article_name FROM Articles ORDER BY article_id;
