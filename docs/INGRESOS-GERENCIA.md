# Reporte de ingresos para gerencia

Disponible en **Reportes → Ingresos** (`/reportes/ingresos`). Gráfico de líneas
de ingreso total, con desglose por reservas/alojamiento, servicios y consumos;
agrupación Mes/Semana, rango inclusivo Desde/Hasta, total del período y variación
porcentual respecto del anterior. Las semanas empiezan el lunes y los extremos
de la serie se recortan al rango elegido. Se incluyen grupos sin cobros en cero.

## Criterio de ingresos y comparación

Se usa el mismo criterio de ingresos cobrados que el panel financiero existente:
`reservation_payment.amount` para alojamiento y `room_service_charge.total_amount`
cuando `paid_at` no es nulo para servicios/consumos. Minibar y gastronomía se
identifican como consumos; los otros servicios se agrupan en Servicios. Cada cobro
se cuenta una sola vez, incluidos los pagos parciales de alojamiento. No se suman
el valor de una reserva impaga ni cargos que todavía no se cobraron.

Los importes se expresan en ARS, como el panel financiero actual; las tablas de
cobros no tienen una columna de moneda. La fecha de cobro se interpreta en
`America/Argentina/Buenos_Aires`. Los cálculos se acumulan en centavos.

La comparación usa el rango inmediatamente anterior de igual duración, sin
depender de la agrupación elegida. Por ejemplo, para 1 al 7 de octubre compara
24 al 30 de septiembre. Fórmula: `(actual - anterior) / anterior * 100`.
Anterior cero y actual positivo: “Sin base de comparación”; ambos cero: 0%;
anterior positivo y actual cero: -100%. No se muestra Infinity ni NaN.

## Exportación y API

- `GET /api/ingresos?desde=2026-01-01&hasta=2026-10-08&agrupacion=MES`
- `GET /api/ingresos/exportar?...&formato=pdf` o `formato=xlsx`

PDF y Excel comparten el cálculo y los filtros de la pantalla. Incluyen el rango
aplicado, agrupación, total, período anterior, variación, serie y todos los cobros
(no solo la página visible). El PDF incluye el gráfico de líneas y se pagina;
el Excel tiene hojas Resumen, Línea de tiempo y Cobros, con importes numéricos.
El rango máximo es cinco años. Los cambios de fechas se aplican con el botón
“Aplicar período”; la exportación usa las fechas del reporte visible.

## Instalación y validación

No requiere migraciones. Se agregó PDFKit para generar el PDF; Excel usa ExcelJS,
ya existente. Ejecutar `npm.cmd ci` desde backend y reiniciar la API.
`npm.cmd test` incluye casos de fechas, períodos parciales, variaciones, redondeos,
períodos sin datos y exportaciones. El login del sistema continúa siendo simulado;
este cambio no implementa permisos de gerente.

`node scripts/probar-ingresos.js` ejecuta la integración en una instancia temporal
de PostgreSQL y la elimina al terminar, sin usar la base del `.env`. Requiere
PostgreSQL 17 instalado; `PG_BIN` permite indicar otra ubicación de sus ejecutables.
Verifica cobros parciales, impagos, límites de fecha argentina, total, comparación
y descargas por HTTP de ambos formatos.
