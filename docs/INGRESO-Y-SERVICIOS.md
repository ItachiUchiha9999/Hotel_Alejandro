# Ingreso de huéspedes y servicios por habitación

El check-in registra al titular y a todos los acompañantes, con documento,
nombre, apellido y categoría adulto/menor. Las cantidades deben coincidir con
la lista de personas. También se controla la capacidad total y el máximo de
adultos del tipo de habitación antes de registrar el ingreso.

Los servicios se cargan seleccionando una habitación ocupada. La API permite
consultar y cargar cargos sin indicar una reserva:

```text
GET /api/servicios-habitacion/habitaciones/:roomId/cargos
POST /api/servicios-habitacion/habitaciones/:roomId/cargos
{ "serviceId": 7, "quantity": 2, "employeeId": 1 }
```

El backend identifica la estadía activa y guarda su vínculo internamente para
separar los consumos de huéspedes sucesivos. Rechaza habitaciones sin estadía
activa o con más de una estadía activa. La pantalla envía además
`expectedReservationId` como control opcional: si cambió la ocupación desde que
se abrió, se rechaza el cargo para evitar facturarlo al siguiente huésped.
Los clientes anteriores que envían `reservationId` siguen siendo compatibles.

La gestión de precios ya disponible permite administrar tarifas de alojamiento
y precios de servicios. Los cargos conservan el precio aplicado al registrarlos.
La edición y el estado de tarifas se describen en `TARIFAS-EDICION.md`.

Estos ajustes no requieren nuevas migraciones. Se mantienen las migraciones
existentes necesarias para huéspedes, servicios, inventario, pagos y tarifas.

Validación automatizada: `npm test` desde `backend` incluye pruebas de carga y
consulta por habitación, separación de estadías, pantalla desactualizada,
conservación de precios e ingreso con validación de datos y capacidad. Estas
pruebas usan una conexión simulada; no sustituyen una prueba de integración
contra PostgreSQL ni la comprobación manual en la interfaz.
