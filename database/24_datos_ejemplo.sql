/**
 * Datos de ejemplo realistas del Hotel Alejandro I.
 *
 * Objetivo: dejar el sistema con un recorrido completo para mostrar/demostrar
 * sin tener que cargar todo a mano: habitaciones, huéspedes, reservas en
 * distintos estados, cobros de alojamiento, consumos de servicios y bloqueos
 * de housekeeping.
 *
 * Es IDEMPOTENTE: se puede ejecutar varias veces sobre la misma base sin
 * duplicar registros. No modifica ni borra datos existentes.
 *
 *   psql -v ON_ERROR_STOP=1 -U postgres -d sistema_hotelero_db \
 *        -f database/24_datos_ejemplo.sql
 *
 * Cómo reconocer los ejemplos:
 *   - Reservas con código RES-EJ-XXXX.
 *   - Habitaciones 401 a 406 (piso 4).
 *   - Observaciones que empiezan con "EJEMPLO:".
 *   - Servicios con nombres descriptivos (Desayuno buffet, Lavandería...).
 *
 * Las fechas son relativas a CURRENT_DATE, así el recorrido sigue siendo útil
 * el día que se carga. Volver a ejecutarlo NO mueve fechas ya cargadas.
 */

BEGIN;

-- =====================================================================
-- 1. Empleado de recepción para las reservas de ejemplo
-- =====================================================================

INSERT INTO employees (rol_id, employees_name, employees_lastname,
                       employees_email, employees_phone)
SELECT r.rol_id, 'Valentina', 'Ríos', 'vrios@hotelalejandro.com', '+543874556611'
FROM roles r
WHERE r.rol_name = 'RECEPCION'
ON CONFLICT (employees_email) DO NOTHING;

-- =====================================================================
-- 2. Habitaciones del piso 4
--    Se usan tipos que existen en cualquier instalación (DOBLE, TRIPLE,
--    SUITE) para que el script no dependa de tipos personalizados.
-- =====================================================================

INSERT INTO room (room_number, room_type_id, floor_number, room_status,
                  view_type, observations)
SELECT h.numero, rt.room_type_id, 4, 'DISPONIBLE', h.vista,
       'EJEMPLO: habitación para demostración'
FROM (VALUES
    ('401', 'DOBLE',  'Interna'),
    ('402', 'DOBLE',  'Ciudad'),
    ('403', 'DOBLE',  'Cerro'),
    ('404', 'TRIPLE', 'Ciudad'),
    ('405', 'SUITE',  'Cerro'),
    ('406', 'SUITE',  'Panorámica')
) AS h(numero, tipo, vista)
JOIN room_type rt ON rt.room_type_name = h.tipo
ON CONFLICT (room_number) DO NOTHING;

-- =====================================================================
-- 3. Huéspedes de ejemplo (nombres y documentos verosímiles de Salta y NOA)
--    Los correos usan example.com para no apuntar a personas reales.
-- =====================================================================

INSERT INTO guest (document_type, document_number, first_name, last_name,
                   email, phone, birth_date, nationality, address, observations)
VALUES
    ('DNI', '34562118', 'Martina',   'Villafañe', 'martina.villafane@example.com',
     '+5493875551234', '1990-04-12', 'Argentina', 'Rivadavia 780, Salta',
     'EJEMPLO: huésped de demostración'),
    ('DNI', '28904771', 'Gonzalo',   'Alderete',  'gonzalo.alderete@example.com',
     '+5493875552345', '1981-09-03', 'Argentina', 'Av. Belgrano 1450, Salta',
     'EJEMPLO: huésped de demostración'),
    ('PASAPORTE', 'YA1234567', 'Camila', 'Duarte', 'camila.duarte@example.com',
     '+5491155553456', '1994-01-27', 'Argentina', 'Palermo, CABA',
     'EJEMPLO: huésped de demostración'),
    ('DNI', '41223905', 'Ramiro',    'Cruz',      'ramiro.cruz@example.com',
     '+5493885554567', '1998-06-18', 'Argentina', 'San Salvador de Jujuy, Jujuy',
     'EJEMPLO: huésped de demostración'),
    ('DNI', '37118442', 'Florencia', 'Brizuela',  'florencia.brizuela@example.com',
     '+5493875555678', '1993-11-05', 'Argentina', 'San Lorenzo, Salta',
     'EJEMPLO: huésped de demostración'),
    ('PASAPORTE', 'BR9988776', 'João', 'Pereira', 'joao.pereira@example.com',
     '+5511999556789', '1988-03-22', 'Brasil', 'São Paulo, Brasil',
     'EJEMPLO: huésped de demostración'),
    ('DNI', '22450318', 'Estela',    'Yapura',    'estela.yapura@example.com',
     '+5493875556789', '1972-08-30', 'Argentina', 'Cerrillos, Salta',
     'EJEMPLO: huésped de demostración'),
    ('DNI', '39887205', 'Tomás',     'Figueroa',  'tomas.figueroa@example.com',
     '+5493815557890', '1996-12-14', 'Argentina', 'San Miguel de Tucumán, Tucumán',
     'EJEMPLO: huésped de demostración')
ON CONFLICT (document_type, document_number) DO NOTHING;

-- =====================================================================
-- 4. Reservas
--
-- Estados que quedan armados:
--   RES-EJ-0001  confirmada, llega hoy         -> probar check-in
--   RES-EJ-0002  en casa, con consumos          -> probar folio y cobros
--   RES-EJ-0003  finalizada y pagada            -> historial y check-out
--   RES-EJ-0004  confirmada futura              -> modificar/cancelar
--   RES-EJ-0005  pendiente                      -> confirmar o dejar vencer
--   RES-EJ-0006  familia con menor              -> validar capacidad
--   RES-EJ-0007  cancelada                      -> ver motivo
--   RES-EJ-0008  no-show                        -> ver historial
--
-- Las que terminan IN_HOUSE o FINALIZADA se insertan como CONFIRMADA y el
-- check-in/check-out real se registra más abajo, para que los triggers
-- escriban el historial y muevan el estado de las habitaciones.
-- =====================================================================

INSERT INTO reservation (reservation_code, guest_id, room_id,
                         check_in_date, check_out_date, adults, children,
                         price_per_night, rate_id, policy_id,
                         reservation_status, reservation_source, observations,
                         employees_id, pending_expires_at,
                         arrival_time, estimated_departure_time)
SELECT v.code, g.guest_id, r.room_id,
       CURRENT_DATE + v.in_off, CURRENT_DATE + v.out_off,
       v.adults, v.children,
       rate.base_price, rate.rate_id, cp.policy_id,
       CASE WHEN v.pending THEN 'PENDIENTE' ELSE 'CONFIRMADA' END,
       v.source, 'EJEMPLO: ' || v.note,
       e.employees_id,
       CASE WHEN v.pending THEN CURRENT_TIMESTAMP + INTERVAL '2 days' END,
       v.arrival::time, v.departure::time
FROM (VALUES
    ('RES-EJ-0001', '34562118', 'DNI', '402',  0,  2, 2, 0,
     'Llegada hoy: pareja en aniversario', 'WEB',        'FLEXIBLE', FALSE, '14:00', '10:00'),
    ('RES-EJ-0002', '28904771', 'DNI', '403', -1,  2, 2, 0,
     'Estadía en curso: huésped corporativo', 'RECEPCION', 'MODERADA', FALSE, '15:00', '09:30'),
    ('RES-EJ-0003', 'YA1234567', 'PASAPORTE', '406', -4, -1, 2, 0,
     'Estadía finalizada: turista de Buenos Aires', 'AGENCIA', 'ESTRICTA', FALSE, '13:00', '10:00'),
    ('RES-EJ-0004', '41223905', 'DNI', '401',  3,  6, 1, 0,
     'Reserva futura: viaje de trabajo', 'TELEFONO', 'FLEXIBLE', FALSE, '18:00', '08:00'),
    ('RES-EJ-0005', '37118442', 'DNI', '405',  5,  8, 2, 0,
     'Pendiente de confirmación: escapada de fin de semana', 'WEB', 'MODERADA', TRUE, '16:00', '11:00'),
    ('RES-EJ-0006', 'BR9988776', 'PASAPORTE', '404',  1,  4, 2, 1,
     'Familia con un menor: turismo por Salta', 'WEB', 'FLEXIBLE', FALSE, '14:30', '10:00'),
    ('RES-EJ-0007', '22450318', 'DNI', '402', -10, -8, 1, 0,
     'Reserva cancelada: cambio de planes', 'WEB', 'MODERADA', FALSE, NULL, NULL),
    ('RES-EJ-0008', '39887205', 'DNI', '404', -6, -4, 2, 0,
     'No-show: no se presentó en recepción', 'RECEPCION', 'FLEXIBLE', FALSE, '20:00', '10:00')
) AS v(code, doc, doc_type, room, in_off, out_off, adults, children,
       note, source, policy, pending, arrival, departure)
JOIN guest g  ON g.document_type = v.doc_type AND g.document_number = v.doc
JOIN room r   ON r.room_number = v.room
JOIN LATERAL (
    SELECT rr.rate_id, rr.base_price
    FROM room_type_rate rr
    WHERE rr.room_type_id = r.room_type_id
      AND rr.valid_to IS NULL
    ORDER BY rr.valid_from DESC
    LIMIT 1
) rate ON TRUE
JOIN cancellation_policy cp ON cp.policy_name = v.policy
JOIN employees e ON e.employees_email = 'vrios@hotelalejandro.com'
WHERE NOT EXISTS (
    SELECT 1
    FROM reservation x
    WHERE x.room_id = r.room_id
      AND x.reservation_status IN ('PENDIENTE', 'CONFIRMADA', 'IN_HOUSE')
      AND daterange(x.check_in_date, x.check_out_date, '[)')
          && daterange(CURRENT_DATE + v.in_off, CURRENT_DATE + v.out_off, '[)')
)
ON CONFLICT (reservation_code) DO NOTHING;

-- =====================================================================
-- 5. Check-in de las reservas que están en casa y de la finalizada
-- =====================================================================

INSERT INTO reservation_check_in (reservation_id, check_in_at,
                                  actual_adults, actual_children,
                                  observations, employees_id)
SELECT res.reservation_id,
       CURRENT_TIMESTAMP - v.days * INTERVAL '1 day',
       res.adults, res.children,
       'EJEMPLO: check-in registrado por recepción',
       e.employees_id
FROM (VALUES
    ('RES-EJ-0002', 1),
    ('RES-EJ-0003', 4)
) AS v(code, days)
JOIN reservation res ON res.reservation_code = v.code
JOIN employees e ON e.employees_email = 'vrios@hotelalejandro.com'
WHERE res.reservation_status = 'CONFIRMADA'
  AND NOT EXISTS (
      SELECT 1 FROM reservation_check_in ci
      WHERE ci.reservation_id = res.reservation_id
  );

-- Huéspedes identificados en cada check-in (titular y acompañantes).
INSERT INTO reservation_stay_guest (reservation_id, guest_role, person_type,
                                    document_type, document_number,
                                    first_name, last_name, employees_id)
SELECT res.reservation_id, v.role, v.person_type,
       v.doc_type, v.doc, v.first_name, v.last_name, e.employees_id
FROM (VALUES
    ('RES-EJ-0002', 'TITULAR',     'ADULTO', 'DNI',      '28904771', 'Gonzalo', 'Alderete'),
    ('RES-EJ-0002', 'ACOMPANANTE', 'ADULTO', 'DNI',      '31222333', 'María',   'Alderete'),
    ('RES-EJ-0003', 'TITULAR',     'ADULTO', 'PASAPORTE', 'YA1234567', 'Camila', 'Duarte'),
    ('RES-EJ-0003', 'ACOMPANANTE', 'ADULTO', 'DNI',      '36777888', 'Lucía',   'Duarte')
) AS v(code, role, person_type, doc_type, doc, first_name, last_name)
JOIN reservation res ON res.reservation_code = v.code
JOIN employees e ON e.employees_email = 'vrios@hotelalejandro.com'
WHERE NOT EXISTS (
    SELECT 1 FROM reservation_stay_guest sg
    WHERE sg.reservation_id = res.reservation_id
      AND sg.document_type = v.doc_type
      AND sg.document_number = v.doc
);

-- =====================================================================
-- 6. Check-out de la estadía finalizada
-- =====================================================================

INSERT INTO reservation_check_out (reservation_id, check_out_at,
                                   pending_charges, pending_detail,
                                   observations, employees_id)
SELECT res.reservation_id,
       CURRENT_TIMESTAMP - INTERVAL '1 day',
       FALSE, NULL,
       'EJEMPLO: salida con folio cerrado y pago completo',
       e.employees_id
FROM reservation res
JOIN employees e ON e.employees_email = 'vrios@hotelalejandro.com'
WHERE res.reservation_code = 'RES-EJ-0003'
  AND res.reservation_status = 'IN_HOUSE'
  AND NOT EXISTS (
      SELECT 1 FROM reservation_check_out co
      WHERE co.reservation_id = res.reservation_id
  );

-- =====================================================================
-- 7. Cancelación y no-show
-- =====================================================================

UPDATE reservation
SET reservation_status = 'CANCELADA',
    cancelled_at = CURRENT_TIMESTAMP - INTERVAL '2 days',
    cancellation_reason = 'EJEMPLO: el huésped cambió de planes'
WHERE reservation_code = 'RES-EJ-0007'
  AND reservation_status = 'CONFIRMADA';

UPDATE reservation
SET reservation_status = 'NO_SHOW'
WHERE reservation_code = 'RES-EJ-0008'
  AND reservation_status = 'CONFIRMADA';

-- =====================================================================
-- 8. Cobros de alojamiento (seña, pago parcial y pago total)
-- =====================================================================

INSERT INTO reservation_payment (reservation_id, payment_method_id, amount,
                                 paid_at, payment_reference, employees_id)
SELECT res.reservation_id, pm.payment_method_id, v.amount,
       CURRENT_TIMESTAMP - v.days * INTERVAL '1 day',
       v.reference, e.employees_id
FROM (VALUES
    ('RES-EJ-0001', 'TRANSFERENCIA',  9000.00, 0, 'EJ-TRANSF-0001'),
    ('RES-EJ-0002', 'TARJETA',       15000.00, 1, 'EJ-TARJ-0002'),
    ('RES-EJ-0003', 'TRANSFERENCIA', 405000.00, 1, 'EJ-TRANSF-0003'),
    ('RES-EJ-0006', 'EFECTIVO',      10000.00, 0, 'EJ-CAJA-0006')
) AS v(code, method, amount, days, reference)
JOIN reservation res ON res.reservation_code = v.code
JOIN payment_method pm ON pm.payment_method = v.method
JOIN employees e ON e.employees_email = 'vrios@hotelalejandro.com'
WHERE NOT EXISTS (
    SELECT 1 FROM reservation_payment rp
    WHERE rp.payment_reference = v.reference
);

-- =====================================================================
-- 9. Catálogo de servicios de habitación
--    El minibar se vincula al artículo FRI-001 y al depósito del frigobar.
-- =====================================================================

INSERT INTO room_service_catalog (category, service_name, description,
                                  current_price, currency, active, created_by,
                                  inventory_article_id, inventory_deposit_id)
SELECT v.category, v.name, v.description, v.price, 'ARS', TRUE,
       e.employees_id,
       CASE WHEN v.category = 'MINIBAR' THEN a.article_id END,
       CASE WHEN v.category = 'MINIBAR' THEN d.deposit_id END
FROM (VALUES
    ('GASTRONOMIA',    'Desayuno buffet',              'Desayuno completo servido en el salón comedor', 8500.00),
    ('LAVANDERIA',     'Lavandería por kilo',          'Lavado, secado y planchado por kilogramo',      6200.00),
    ('ESTACIONAMIENTO','Estacionamiento cubierto',     'Cochera cubierta por noche',                     4500.00),
    ('TRANSPORTE',     'Traslado aeropuerto',          'Traslado al aeropuerto Martín Miguel de Güemes', 28000.00),
    ('MINIBAR',        'Minibar: agua mineral 500 ml', 'Botella de agua sin gas de 500 ml',              3500.00)
) AS v(category, name, description, price)
JOIN employees e ON e.employees_email = 'vrios@hotelalejandro.com'
LEFT JOIN articles a ON a.article_code = 'FRI-001'
LEFT JOIN deposit d  ON d.deposit_name = 'Depósito Resto Bar / Frigobar'
WHERE v.category <> 'MINIBAR'
   OR (a.article_id IS NOT NULL AND d.deposit_id IS NOT NULL)
ON CONFLICT (service_name) DO NOTHING;

-- Normaliza servicios cargados por versiones anteriores de este seed: solo
-- MINIBAR puede tener artículo y depósito asociados.
UPDATE room_service_catalog
SET inventory_article_id = NULL,
    inventory_deposit_id = NULL
WHERE category <> 'MINIBAR'
  AND service_name IN ('Desayuno buffet', 'Lavandería por kilo',
                       'Estacionamiento cubierto', 'Traslado aeropuerto');

-- Historial inicial de precios, igual que registra el backend al crear un
-- servicio. Sin esto la pantalla de historial queda vacía para los ejemplos.
INSERT INTO room_service_price_history (service_id, previous_price,
                                        new_price, valid_from, employees_id)
SELECT sc.service_id, NULL, sc.current_price, CURRENT_TIMESTAMP, e.employees_id
FROM room_service_catalog sc
JOIN employees e ON e.employees_email = 'vrios@hotelalejandro.com'
WHERE sc.service_name IN ('Desayuno buffet', 'Lavandería por kilo',
                          'Estacionamiento cubierto', 'Traslado aeropuerto',
                          'Minibar: agua mineral 500 ml')
  AND NOT EXISTS (
      SELECT 1 FROM room_service_price_history h
      WHERE h.service_id = sc.service_id
  );

-- =====================================================================
-- 10. Consumos imputados a las estadías
--     RES-EJ-0002: desayuno pagado y lavandería pendiente.
--     RES-EJ-0003: estacionamiento y minibar, ambos pagados.
-- =====================================================================

INSERT INTO room_service_charge (reservation_id, room_id, service_id,
                                 service_name, quantity, unit_price,
                                 charged_at, employees_id,
                                 paid_at, paid_by, payment_method_id,
                                 payment_reference)
SELECT res.reservation_id, res.room_id, sc.service_id, sc.service_name,
       v.quantity, sc.current_price,
       CURRENT_TIMESTAMP - v.days * INTERVAL '1 day',
       e.employees_id,
       CASE WHEN v.paid
            THEN CURRENT_TIMESTAMP - (v.days - 1) * INTERVAL '1 day'
       END,
       CASE WHEN v.paid THEN e.employees_id END,
       CASE WHEN v.paid THEN pm.payment_method_id END,
       v.reference
FROM (VALUES
    ('RES-EJ-0002', 'Desayuno buffet',              2, 1, TRUE,  'TARJETA',  'EJ-CARGO-0001'),
    ('RES-EJ-0002', 'Lavandería por kilo',          3, 1, FALSE, NULL,       NULL),
    ('RES-EJ-0003', 'Estacionamiento cubierto',     1, 3, TRUE,  'EFECTIVO', 'EJ-CARGO-0002'),
    ('RES-EJ-0003', 'Minibar: agua mineral 500 ml', 2, 3, TRUE,  'EFECTIVO', 'EJ-CARGO-0003')
) AS v(code, service, quantity, days, paid, method, reference)
JOIN reservation res ON res.reservation_code = v.code
JOIN room_service_catalog sc ON sc.service_name = v.service
LEFT JOIN payment_method pm ON pm.payment_method = v.method
JOIN employees e ON e.employees_email = 'vrios@hotelalejandro.com'
WHERE NOT EXISTS (
    SELECT 1 FROM room_service_charge c
    WHERE c.reservation_id = res.reservation_id
      AND c.service_id = sc.service_id
      AND c.payment_reference IS NOT DISTINCT FROM v.reference
);

-- El consumo de minibar también descuenta stock, igual que hace el backend.
DO $$
DECLARE
    v_movement_id INT;
    v_stock_id    INT;
BEGIN
    IF EXISTS (
        SELECT 1 FROM stock_movement
        WHERE observations = 'EJEMPLO: consumo de minibar de RES-EJ-0003'
    ) THEN
        RETURN;
    END IF;

    SELECT s.stock_id INTO v_stock_id
    FROM articles_deposit_stock s
    JOIN articles a ON a.article_id = s.article_id
    JOIN deposit d  ON d.deposit_id = s.deposit_id
    WHERE a.article_code = 'FRI-001'
      AND d.deposit_name = 'Depósito Resto Bar / Frigobar';

    IF v_stock_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO stock_movement (movement_type_id, deposit_origin_id,
                                employees_id, observations)
    SELECT mt.movement_type_id, d.deposit_id, e.employees_id,
           'EJEMPLO: consumo de minibar de RES-EJ-0003'
    FROM movement_type mt
    JOIN deposit d   ON d.deposit_name = 'Depósito Resto Bar / Frigobar'
    JOIN employees e ON e.employees_email = 'smartinez@hotelalejandro.com'
    WHERE mt.movement_type = 'CONSUMO'
    RETURNING stock_movement_id INTO v_movement_id;

    IF v_movement_id IS NOT NULL THEN
        INSERT INTO movement_stock_detail (stock_movement_id, stock_id, amount)
        VALUES (v_movement_id, v_stock_id, 2);

        UPDATE articles_deposit_stock
        SET stock_amount = stock_amount - 2,
            update_date = CURRENT_TIMESTAMP
        WHERE stock_id = v_stock_id;
    END IF;
END $$;

-- =====================================================================
-- 11. Housekeeping
--     - 401: mantenimiento abierto (service de aire acondicionado).
--     - 406: limpieza abierta después del check-out.
-- =====================================================================

INSERT INTO room_maintenance (room_id, maintenance_type, start_date,
                              estimated_end_date, reason, opened_by)
SELECT r.room_id, v.type,
       CURRENT_DATE + v.start_off, CURRENT_DATE + v.end_off,
       v.reason, e.employees_id
FROM (VALUES
    ('401', 'MANTENIMIENTO', 0, 2, 'EJEMPLO: service de aire acondicionado'),
    ('406', 'LIMPIEZA',      0, 0, 'EJEMPLO: limpieza posterior al check-out')
) AS v(room, type, start_off, end_off, reason)
JOIN room r ON r.room_number = v.room
JOIN employees e ON e.employees_email = 'smartinez@hotelalejandro.com'
WHERE NOT EXISTS (
    SELECT 1 FROM room_maintenance m
    WHERE m.room_id = r.room_id
      AND m.reason = v.reason
);

COMMIT;
