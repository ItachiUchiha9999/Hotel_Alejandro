# Datos de ejemplo para demostraciones

El script `database/24_datos_ejemplo.sql` carga un recorrido completo del
hotel con datos verosímiles de Salta y el NOA. Sirve para mostrar el sistema
sin cargar todo a mano y sin pisar los datos que ya existan.

## Cómo cargarlo

Desde la raíz del proyecto:

```powershell
psql -v ON_ERROR_STOP=1 -U postgres -d sistema_hotelero_db `
     -f database/24_datos_ejemplo.sql
```

Es **idempotente**: se puede ejecutar varias veces y no duplica registros.
Tampoco borra ni modifica reservas, huéspedes o habitaciones ajenas al ejemplo.

## Qué deja cargado

| Elemento | Cantidad | Detalle |
|---|---:|---|
| Habitaciones | 6 | 401 a 406, piso 4 (dobles, triples y suites) |
| Huéspedes | 8 | Nombres, DNI/pasaportes y direcciones verosímiles |
| Reservas | 8 | Un caso por estado: confirmada, en casa, finalizada, pendiente, cancelada y no-show |
| Cobros de alojamiento | 4 | Seña, pago parcial y pago total |
| Servicios | 5 | Desayuno, lavandería, estacionamiento, traslado y minibar |
| Consumos | 4 | Pagados y pendientes, imputados a las estadías |
| Housekeeping | 2 | Un mantenimiento y una limpieza abiertos |

### Reservas

Las fechas son relativas al día de la carga, así el recorrido sigue siendo
útil. Las reservas de ejemplo usan el código `RES-EJ-XXXX`.

| Reserva | Habitación | Estado | Caso para probar |
|---|---|---|---|
| `RES-EJ-0001` | 402 | Confirmada, llega hoy | Registrar check-in; la habitación debe pasar a OCUPADA. Tiene una seña de $9.000. |
| `RES-EJ-0002` | 403 | En casa | Consultar el folio: alojamiento $45.000, pagado $15.000. Tiene desayuno pagado y lavandería pendiente. |
| `RES-EJ-0003` | 406 | Finalizada y pagada | Ver historial, consumos y el check-out ya registrado. La habitación quedó en LIMPIEZA. |
| `RES-EJ-0004` | 401 | Confirmada futura | Modificar fechas, cambiar de habitación o cancelar. La habitación 401 tiene un mantenimiento abierto. |
| `RES-EJ-0005` | 405 | Pendiente | Confirmar o dejar vencer. Vence 2 días después de la carga. |
| `RES-EJ-0006` | 404 | Confirmada, familia | 2 adultos y 1 menor; permite probar la validación de capacidad. |
| `RES-EJ-0007` | 402 | Cancelada | Ver el motivo de cancelación. No debe admitir check-in. |
| `RES-EJ-0008` | 404 | No-show | Ver el historial; no ocupa la habitación. |

### Servicios y consumos

- **Desayuno buffet** — $8.500.
- **Lavandería por kilo** — $6.200.
- **Estacionamiento cubierto** — $4.500.
- **Traslado aeropuerto** — $28.000.
- **Minibar: agua mineral 500 ml** — $3.500, vinculado al artículo `FRI-001`
  y al depósito del frigobar. El consumo de ejemplo descuenta 2 unidades del
  stock, igual que hace el backend.

### Housekeeping

- **Habitación 401**: mantenimiento abierto por el service del aire
  acondicionado, con cierre estimado a 2 días.
- **Habitación 406**: limpieza abierta posterior al check-out.

## Cómo reconocer y quitar los ejemplos

Los registros de ejemplo se identifican por:

- Reservas con código `RES-EJ-`.
- Habitaciones `401` a `406`.
- Observaciones y motivos que empiezan con `EJEMPLO:`.
- Correos de huéspedes terminados en `@example.com`.

El script es aditivo: no elimina datos existentes. Si necesitás quitar los
ejemplos, hacelo con una copia de respaldo y borrando primero las filas hijas
de las reservas `RES-EJ-%` (check-in, check-out, acompañantes, pagos y
consumos) antes que las reservas.

## Verificación rápida

```sql
SELECT reservation_code, reservation_status, check_in_date, check_out_date
FROM reservation
WHERE reservation_code LIKE 'RES-EJ-%'
ORDER BY reservation_code;
```

Los estados esperados son:

```
RES-EJ-0001  CONFIRMADA
RES-EJ-0002  IN_HOUSE
RES-EJ-0003  FINALIZADA
RES-EJ-0004  CONFIRMADA
RES-EJ-0005  PENDIENTE
RES-EJ-0006  CONFIRMADA
RES-EJ-0007  CANCELADA
RES-EJ-0008  NO_SHOW
```

---

# Carga masiva para demos completas

`backend/scripts/seed-demo-masivo.js` carga un set grande y coherente para que
**todos** los módulos y gráficos tengan información representativa. Convive
con el ejemplo anterior (`database/24_datos_ejemplo.sql`): no lo reemplaza ni
lo borra.

## Cómo cargarla

Desde `backend/`:

```powershell
node scripts/seed-demo-masivo.js            # carga completa (una sola vez)
node scripts/seed-demo-masivo.js --estado   # resumen de lo que hay en la base
```

Opciones:

| Opción | Qué hace |
|---|---|
| `--estado` | Muestra el conteo de las tablas principales. No modifica nada. |
| `--futuras` | Genera solo las reservas futuras (noviembre, diciembre y primeros días de enero). |
| `--reset-futuras` | Borra únicamente las reservas `RES-FUT-%` y sus cobros, para regenerarlas. |
| `--reparar-cuenta` | Completa el movimiento de débito de comprobantes que hayan quedado sin él. |

Todo corre en **una sola transacción**: si algo falla, no deja datos a medias.
Es aditiva e idempotente: al terminar graba en `hotel_parameter` la clave
`DEMO_MASIVO_VERSION` y, si ya existe, no vuelve a cargar. Las reservas futuras
tienen su propio marcador (`DEMO_MASIVO_FUTURAS`).

## Qué deja cargado

Cifras de referencia de una base recién instalada más las dos semillas:

| Elemento | Cantidad | Detalle |
|---|---:|---|
| Habitaciones | 52 | Pisos 1 a 5, numeración `101`–`510`; se renombran `MAT-001` → `111` y `SUITE-6A` → `511` |
| Tipos de habitación | 9 | `SIMPLE`, `DOBLE`, `TRIPLE`, `SUITE`, `DOBLE SUPERIOR`, `DOBLE TWIN`, `CUADRUPLE FAMILIAR`, `SUITE JUNIOR`, `SUITE PRESIDENCIAL` |
| Tarifas | 79 | Series `ALTA`, `GENERAL`, `BAJA` y `ESPECIAL` para todo el año |
| Huéspedes | 156 | 140 nuevos, con DNI o pasaporte, domicilios de Salta y el NOA |
| Reservas | 821 | 385 históricas (`RES-MAS-####`), 420 futuras (`RES-FUT-####`) y las de los ejemplos anteriores |
| Cobros de alojamiento | 870 | Señas, pagos parciales y saldos, distribuidos de enero a diciembre |
| Consumos de servicios | 380 | Minibar, desayuno, late check-out, spa y cuna |
| Check-in / check-out | 351 / 346 | Con acompañantes registrados (`reservation_stay_guest`) |
| Pedidos web | 274 | Con confirmación y seguimiento de correo |
| Housekeeping | 15 mantenimientos y 6 retenciones | Bloqueos pasados, uno vigente y retenciones liberadas |
| Proveedores | 11 | 6 nuevos, con CUIT válido y condición fiscal |
| Comprobantes | 42 | Facturas A/B/C con vencimiento y estado |
| Órdenes de compra | 14 | Una por mes con su historial de estado |
| Gastos | 15 | Imputados a comprobantes de proveedor |
| Órdenes de pago | 42 | Confirmadas, con forma de pago y referencia |
| Cuenta corriente | 84 movimientos | Débitos por comprobante y créditos por pago |
| Inventario | 17 artículos, 5 depósitos y 171 movimientos | Compras, transferencias, consumos y ajustes |

## Cómo alimenta los gráficos y reportes

| Pantalla | Origen de los datos |
|---|---|
| Ingresos | `reservation_payment.paid_at` (alojamiento), `room_service_charge.paid_at` (servicios y consumos) y `reservation.reservation_source` |
| Egresos | `payment_order.confirmed_date`, `expense` + `expense_voucher`, `purchase_order` y `supplier_voucher` |
| Temporadas | `reservation.rate_id` → `room_type_rate.season_name`, noches y capacidad de habitaciones activas |
| Ventas por canal | `reservation.reservation_source` (`RECEPCION`, `WEB`, `TELEFONO`, `AGENCIA`, `CORPORATIVO`) |
| Ocupación y calendario | Reservas históricas, reservas futuras de noviembre y diciembre, retenciones y bloqueos de housekeeping |
| Cuenta corriente | `supplier_account_movement` (débitos y créditos por proveedor) |

## Reservas de la demo

- `RES-MAS-####`: estadías históricas de enero a octubre, en todos los estados
  (`FINALIZADA`, `CANCELADA`, `NO_SHOW`, `CONFIRMADA`).
- `RES-FUT-####`: reservas de noviembre y diciembre (y salidas hasta el 5 de
  enero), `CONFIRMADA` o `PENDIENTE`, sin check-in.

Los huéspedes, reservas y movimientos de la carga masiva se reconocen por:

- Códigos de reserva `RES-MAS-` y `RES-FUT-`.
- Observaciones que empiezan con `DEMO MASIVO:`.
- Huéspedes con `observations = 'DEMO MASIVO'`.
- Parámetros `DEMO_MASIVO_VERSION` y `DEMO_MASIVO_FUTURAS`.

## Cómo quitarla

La carga completa está pensada para una base de demostración. Para volver a
empezar desde cero, reinstalá la base con `database/instalar.sql` y volvé a
correr las semillas que quieras.

Si solo querés rehacer el calendario, usá `--reset-futuras` y después
`--futuras`. Ese par no toca las reservas históricas ni el resto de los datos.

## Verificación rápida

```sql
-- Reservas por origen de la demo
SELECT CASE
         WHEN reservation_code LIKE 'RES-MAS-%' THEN 'histórica'
         WHEN reservation_code LIKE 'RES-FUT-%' THEN 'futura'
         ELSE 'otras'
       END AS grupo,
       reservation_status,
       count(*)
FROM reservation
GROUP BY 1, 2
ORDER BY 1, 2;

-- Ocupación diaria de los próximos 60 días
SELECT d::date AS dia, count(r.reservation_id) AS reservas
FROM generate_series(CURRENT_DATE, CURRENT_DATE + 60, '1 day') d
LEFT JOIN reservation r
       ON r.check_in_date <= d::date
      AND r.check_out_date > d::date
      AND r.reservation_status IN ('PENDIENTE', 'CONFIRMADA', 'IN_HOUSE')
GROUP BY 1
ORDER BY 1;
```
