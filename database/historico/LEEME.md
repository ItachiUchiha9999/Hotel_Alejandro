# Scripts históricos

Estos archivos quedaron cubiertos por `database/DB-hotel.pgsql`, que crea la
base completa desde cero. Se conservan solo como referencia de cómo evolucionó
el esquema.

**No ejecutarlos sobre una base nueva.** Correrlos después del script principal
puede dejar tablas a medias o datos duplicados; fue lo que pasó en el Sprint 2,
cuando convivían dos scripts con esquemas distintos.

| Archivo | Qué hacía | Dónde está ahora |
|---|---|---|
| `01_schema.sql` | Esquema de stock e insumos | Incluido en `DB-hotel.pgsql` |
| `02_seed.sql` | Datos semilla del Sprint 1 | Incluido en `DB-hotel.pgsql` |
| `03_migracion_desde_enum.sql` | Migración del `type_operation_enum` a `Movement_Type` | Ya no aplica: el esquema nuevo no usa el enum |
| `09_hab01_hab03_habitaciones.sql` | Tipos de habitación y habitaciones | Incluido en `DB-hotel.pgsql` |

## Sobre el script 09

Definía `room` y `room_type` con nombres de columna distintos a los de
`DB-hotel.pgsql` (`room_state` en lugar de `room_status`,
`room_type_max_capacity` en lugar de `max_capacity`). Como usa
`CREATE TABLE IF NOT EXISTS` y el script principal crea esas tablas antes, en la
práctica nunca llegó a ejecutarse: las tablas ya existían.

El código no quedó roto porque `schema.prisma` concilia ambos mundos con `@map`:
los campos de Prisma conservan los nombres largos y apuntan a las columnas
reales. Se archiva para que nadie lo corra sobre una base vacía, donde sí
crearía las tablas con la definición equivocada.
