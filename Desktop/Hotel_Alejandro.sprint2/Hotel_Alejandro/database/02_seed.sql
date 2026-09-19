/**
 * Datos semilla del Hotel Alejandro I.
 * Es idempotente: se puede correr varias veces sin duplicar registros.
 *
 *   psql -d sistema_hotelero_db -f database/02_seed.sql
 *
 * Las contraseñas se guardan hasheadas con bcrypt desde el backend.
 * Estos hashes corresponden a la contraseña "1234" y son SOLO PARA DESARROLLO.
 */

BEGIN;

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

COMMIT;
