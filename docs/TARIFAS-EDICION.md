# Edición y estado de tarifas

En Habitaciones → Tarifas, las filas vigentes y futuras permiten **Editar**,
**Activar/Desactivar** y **Ver cambios**. El filtro Inactivas permite recuperarlas.

- Se pueden editar precio, moneda, temporada y motivo.
- Tipo y fechas quedan fijos para preservar los períodos. Para otro período,
  se registra una nueva tarifa. Las tarifas ya finalizadas son de consulta.
- Desactivar impide nuevas reservas para ese tipo y período, sin volver
  automáticamente a un precio anterior. Reactivar recupera su disponibilidad.
- Las reservas existentes conservan precio por noche e importe. Cambiar sus
  fechas o habitación sigue siendo una nueva cotización según el flujo existente.
- El historial registra valor anterior, nuevo valor, fecha y empleado. La
  identidad del empleado sigue dependiendo del acceso de demostración actual.

La migración `database/17_tarifas_edicion_estado.sql` ya está aplicada en la
base local S3 y conserva sus datos. Se guardó antes una copia en
`backend/antes-tarifas.backup`. Otros entornos deben aplicar esa migración y
regenerar Prisma antes de iniciar el backend.

También se corrigieron las fechas DATE del alta de reservas y los límites
de las consultas de solapamiento para evitar conversiones de zona horaria.
Esto corrige nuevas operaciones; no modifica automáticamente reservas históricas.

Validación: 22 pruebas de housekeeping y una prueba de integración sobre una
copia temporal de la base DEMO. Esta última verifica fechas exactas, reservas
adyacentes y superpuestas, cambios de precio, conservación de importes, rechazo
de tarifas inactivas, reactivación, auditoría y entradas inválidas.

Para repetir la integración, usar una copia desechable de la base DEMO cuyo
nombre comience con `hotel_s3_test_`, aplicar la migración y configurar
`TEST_DATABASE_URL`. Desde backend: `node --test tests/tarifas-reservas.integration.test.js`.
La prueba modifica esa copia. Sin la variable, `npm test` omite la integración.

La pantalla de tarifas pasa ESLint y responde correctamente. La comprobación
global de TypeScript sigue encontrando tres errores previos en comprobantes y
saldo de stock, fuera de este cambio.

Quedan fuera de esta entrega: autenticación real, automatización de no-show y
mantenimiento, y revisión del saldo de alojamiento en el check-out.
