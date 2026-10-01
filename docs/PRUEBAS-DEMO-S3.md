# Datos y recorrido de prueba S3

Carga realizada el 30/09/2026 en `sistema_hotelero_s3_local`.
Abrir http://localhost:3000 e ingresar con `admin` / `1234`.
Los nombres DEMO, documentos DEMO-S3 y habitaciones D01–D12 son ficticios.
Los importes están expresados en ARS. Las expectativas describen el estado inicial;
si realizás las operaciones, los saldos y estados cambian.

## Reservas y recepción

Abrir **Reservas → Listado de reservas**.

| Reserva | Habitación | Caso inicial | Qué probar |
|---|---|---|---|
| RES-2026-000001 | D01 | Confirmada, 30/09–02/10, Lucía Demo | Registrar check-in; debe pasar a IN_HOUSE y la habitación a OCUPADA. |
| RES-2026-000002 | D02 | Pendiente, 02/10–05/10, 2 adultos | Confirmar o cancelar; la pendiente vence automáticamente 24 horas después de su creación. |
| RES-2026-000003 | D03 | Ocupada, 30/09–03/10 | Consultar folio: alojamiento $267.000, pagado $50.000, saldo $217.000. Minibar pagado $5.000 y lavandería pendiente $7.500. |
| RES-2026-000004 | D04 | Finalizada, habitación en LIMPIEZA | Consultar historial y luego marcar habitación limpia desde Housekeeping. |
| RES-2026-000005 | D05 | Cancelada por cambio de planes | Ver motivo; no debe admitir check-in. |
| RES-2026-000006 | D08 | Familia: 2 adultos y 1 menor, 07/10–10/10 | Revisar capacidad, fechas y tarifa; no debe admitir check-in anticipado. |
| RES-2026-000007 | D11 | Ocupada con alojamiento completamente pagado | Alojamiento $178.000; saldo $0. Probar check-out. |

En D03, al intentar check-out con lavandería pendiente, se debe cobrar el cargo
o indicar un motivo para dejarlo pendiente. Los cobros de alojamiento y servicios
son conceptos separados.

## Habitaciones, tarifas y housekeeping

| Habitación | Situación | Prueba sugerida |
|---|---|---|
| D06 | Mantenimiento de aire acondicionado hasta 02/10 | Finalizar mantenimiento y comprobar que vuelve a disponible. |
| D07 | Fuera de servicio hasta 07/10 | Ver que no se pueda reservar para esas fechas. |
| D09 | Mantenimiento futuro del 10/10 al 12/10 | Consultar disponibilidad antes y durante el bloqueo. |
| D10 | Limpieza diaria abierta | Marcar limpia y consultar el historial. |
| D12 | Disponible con mantenimiento finalizado | Consultar historial y crear una reserva nueva. |

Las habitaciones originales 101–301 también quedan disponibles para pruebas.
Hay cuatro tipos de habitación con tarifas generales. Para el primer tipo,
se agregaron tarifas futuras: ALTA $60.000 desde 30/10, BAJA $40.000 desde 29/11
y ESPECIAL $75.000 desde 29/12. Comprobar precios según la fecha de ingreso.

En **Servicios y consumos** hay siete servicios DEMO: minibar, gastronomía,
lavandería, estacionamiento, limpieza, transporte y otros. El minibar descuenta
agua DEMO-001 del depósito DEMO. Probar agregar un consumo a D03 o D11 y cobrarlo.

## Stock

Filtrar por el depósito **DEMO - Insumos de prueba**.

| Código | Caso | Saldo inicial |
|---|---|---|
| DEMO-001 | Agua minibar | 81 en depósito DEMO y 10 en Central: 91 en total. |
| DEMO-002 | Toallas bajo mínimo | 8 unidades, mínimo 20. |
| DEMO-003 | Sin existencias | 0 unidades, mínimo 10. |
| DEMO-004 | Artículo discontinuado | Inactivo. |

El historial incluye ingreso, egreso, consumo, transferencia, ajuste positivo,
ajuste negativo y el consumo de minibar de D03. Probar filtros y exportación.
También existe **DEMO - Deposito inactivo** para verificar los selectores.

## Proveedores, comprobantes, compras y pagos

Buscar **DEMO Suministros Hotel S.A.**. Hay otro proveedor DEMO inactivo.
Todos los comprobantes de ejemplo usan punto de venta **0099**.

| Número | Tipo | Total | Pagado | Caso |
|---|---|---:|---:|---|
| 900001 | Factura A | $100.000 | $30.000 | Vencida, saldo $70.000. |
| 900002 | Factura B | $110.000 | $110.000 | Pagada completamente por transferencia. |
| 900003 | Factura C | $120.000 | $0 | Incluida en una orden de pago en borrador por cheque. |
| 900004 | Nota de débito | $130.000 | $0 | Incrementa la deuda. |
| 900005 | Nota de crédito | $5.000 | — | Reduce la deuda. |
| 900006 | Remito | $150.000 | — | No afecta cuenta corriente. |
| 900007 | Recibo | $160.000 | — | No afecta cuenta corriente. |

Cuenta corriente inicial esperada: débitos $460.000, créditos $145.000,
**saldo $315.000**. Confirmar el borrador de $120.000 debe dejar saldo $195.000.
Las referencias bancarias son ficticias, con prefijo DEMO.

Hay cinco órdenes de compra DEMO, una en cada estado: BORRADOR, EMITIDA,
APROBADA, RECIBIDA y CANCELADA. Cada una tiene 20 toallas a $3.500: total $70.000.
La orden recibida es un caso de estado documental; sus cantidades no se agregaron
al inventario. Las existencias se cargaron mediante movimientos de stock.

## Validaciones negativas

Estas cuatro comprobaciones se ejecutaron contra los servicios y devolvieron 409:

- Reservar D03 en fechas que se superponen con su estadía actual.
- Hacer check-in de la reserva familiar antes de su fecha.
- Retirar 999.999 unidades de DEMO-001 del depósito DEMO.
- Cobrar $1 adicional de alojamiento a D11, que ya tiene saldo cero.

Otras pruebas manuales: transferencia al mismo depósito, cantidades cero o
negativas, pago mayor al saldo de una factura, comprobante duplicado y huésped
adicional sin documento. Deben dar un error y conservar los datos anteriores.

## Hallazgo durante la carga

El alta de reservas mediante SQL en `reservas.service.js` puede guardar las fechas
un día antes: envía medianoche UTC a una columna DATE con la sesión PostgreSQL
en America/Buenos_Aires. Se normalizaron las fechas de los ejemplos activos;
no se modificó el código del producto. Al crear reservas manualmente, comparar
las fechas elegidas con las guardadas. El caso finalizado conserva 29/09–30/09
y el cancelado 04/10–06/10, porque el sistema protege esos estados contra cambios.

## Archivos de la carga

- Script: `backend/scripts/demo-s3.js`, ejecutar desde backend con `node scripts/demo-s3.js`.
- Registro de pasos: `backend/demo-s3.log`. Evita repetir pasos ya completados;
  no eliminarlo ni reutilizarlo con otra base. No restablece ejemplos que hayas editado.
- Copia de la base anterior a la carga: `backend/antes-demo-s3.backup`.
- No se alteró la base original `sistema_hotelero_db`.

No se precargaron todos los estados excepcionales (por ejemplo NO_SHOW o pagos
anulados). La carga cubre los módulos y flujos principales, no una certificación
completa del sistema. Se verificó respuesta HTTP 200 de los listados de reservas,
habitaciones, housekeeping, comprobantes, órdenes de pago y compra, tarifas y stock.
