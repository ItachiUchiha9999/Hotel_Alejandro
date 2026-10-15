-- Agrega el rol de gerencia y su usuario inicial de desarrollo.
-- Seguro para ejecutarse más de una vez sobre una base existente.
BEGIN;

INSERT INTO Roles (rol_name, rol_pass, rol_description)
VALUES (
    'GERENTE',
    '$2b$10$3euPcmQFCiblsZeEu5s7p.9OVHgeHWFxCiWFzoOOOOOOOOOOOOOOO',
    'Supervisión operativa y reportes del hotel'
)
ON CONFLICT (rol_name) DO NOTHING;

INSERT INTO Employees (rol_id, employees_name, employees_lastname, employees_email, employees_phone)
SELECT r.rol_id, 'Gerente', 'Hotel', 'gerente@hotelalejandro.com', '+543874400000'
FROM Roles r
WHERE r.rol_name = 'GERENTE'
  AND NOT EXISTS (
      SELECT 1 FROM Employees e WHERE e.employees_email = 'gerente@hotelalejandro.com'
  );

COMMIT;
