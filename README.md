# Hotel Alejandro I — Sistema de Gestión Integral Hotelera (SIGH)

Proyecto unificado: stock e insumos (Sprint 1), proveedores y compras
(Sprint 2), reservas y habitaciones (Sprint 3).

- **Backend:** Node.js + Express + Prisma sobre PostgreSQL 17
- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4

La documentación de los sprints anteriores quedó en `docs/README-sprints-1-2.md`,
y la especificación de HU-9 en `docs/HU-9_HAB-06_Housekeeping.md`.

---

## Puesta en marcha

Requisitos: Node.js 20.9 o superior, npm y PostgreSQL 17. Ejecutá los pasos
desde la raíz de esta rama; `backend` y `frontend` se instalan por separado.
Usá `npm ci` para instalar las versiones de los archivos `package-lock.json`.
En PowerShell usá `npm.cmd` y `npx.cmd` si la política de ejecución bloquea
los archivos `.ps1`. En Linux/macOS usá `npm` y `npx`.

### 1. Base de datos

```powershell
$env:Path += ";C:\Program Files\PostgreSQL\17\bin"
$env:PGCLIENTENCODING = "UTF8"

createdb -U postgres sistema_hotelero_db

psql -U postgres -d sistema_hotelero_db -f database/instalar.sql
```

`instalar.sql` crea el esquema, carga los datos iniciales y aplica los parches
de housekeeping y tarifas. **Usalo solamente en una base nueva: elimina datos
existentes.** Si `createdb` informa que la base ya existe, no ejecutes el
instalador sobre ella; aplicá los parches incrementales que correspondan.
Si la base ya existía antes del flujo de confirmación de reservas, ejecutá también
`psql -U postgres -d sistema_hotelero_db -f database/11_reservas_pendientes.sql`.
Para bases instaladas antes del registro de huéspedes y cargos por habitación,
ejecutá `psql -U postgres -d sistema_hotelero_db -f database/12_huespedes_y_servicios_habitacion.sql`.
Para agregar categorías al catálogo de servicios en bases existentes, ejecutá
`psql -U postgres -d sistema_hotelero_db -f database/13_categorias_servicios.sql`.
Para agregar trazabilidad de medios de pago, vincular consumos de minibar con el
stock y aplicar el criterio de disponibilidad durante limpieza, ejecutá
`psql -U postgres -d sistema_hotelero_db -f database/14_reservas_minibar_pagos.sql`.
Para registrar pagos parciales o totales de alojamiento, ejecutá
`psql -U postgres -d sistema_hotelero_db -f database/15_cobros_alojamiento.sql`.

Para bases anteriores a las temporadas de tarifas, ejecutá primero
`psql -v ON_ERROR_STOP=1 -U postgres -d sistema_hotelero_db -f database/16_temporadas_tarifas.sql`.

Para habilitar edición, activación/desactivación e historial de tarifas,
ejecutá `psql -U postgres -d sistema_hotelero_db -f database/17_tarifas_edicion_estado.sql`
y después `npx prisma generate` desde `backend`. La migración es incremental;
conserva las tarifas, reservas y datos existentes.

Los scripts de `database/historico/` quedaron cubiertos por el principal y no
hay que ejecutarlos: el detalle está en `database/historico/LEEME.md`.

Verificación:

```powershell
psql -U postgres -d sistema_hotelero_db -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"
```

En una instalación nueva tienen que ser **49 tablas** (incluidas las cuatro de gastos operativos y la cola de correo de ECO-02).

Para agregar la reserva web a una base existente, ejecutar
`database/18_reservas_web.sql` o `node scripts/instalar-eco2.js` desde backend.
Configurar SMTP en `backend/.env` para enviar las confirmaciones. Ver `docs/ECO-02.md`.

Para REP-07, las instalaciones nuevas aplican automáticamente
`database/19_reporte_egresos.sql`. En bases existentes, ejecutar ese script una
vez para crear las tablas de gastos operativos usadas por el reporte.

### 2. Backend

```powershell
cd backend
copy .env.example .env      # completar DATABASE_URL con la contraseña local
npm.cmd ci
npx.cmd prisma generate
npm.cmd test
npm.cmd run dev
```

Queda en `http://localhost:4000`. Para comprobar: `http://localhost:4000/api/health`.
La respuesta de health confirma que la API arrancó; verificá también un módulo
como `/api/tarifas` para comprobar la conexión y el esquema de la base.
El usuario, contraseña, puerto y nombre de base de `DATABASE_URL` deben
coincidir con el PostgreSQL de cada compañero. No uses `prisma db push`
ni `prisma migrate` para instalar esta base: los scripts SQL incluyen triggers
y funciones necesarios para el sistema.

### 3. Frontend

En otra terminal:

```powershell
cd frontend
copy .env.local.example .env.local
npm.cmd ci
npm.cmd run build
npm.cmd run dev
```

Queda en `http://localhost:3000`. Usuario de prueba: `admin` / `1234`.
`NEXT_PUBLIC_API_URL` debe apuntar al backend, sin `/api` al final. Si cambiás
el puerto del frontend, agregá su origen a `CORS_ORIGINS` en `backend/.env`.

Si aparece `@prisma/client did not initialize`, ejecutá `npx.cmd prisma generate`
desde `backend`. Si aparece que una columna o tabla no existe, comprobá los
parches de la base indicada en `DATABASE_URL`. Si el puerto está ocupado,
cerrá la otra instancia o ajustá los puertos y las variables anteriores.

---

## Qué se unificó

Se partió de la versión del grupo, que trae las historias HAB, TAR y RES, y se
le integró HU-9 (HAB-06, housekeeping).

### Módulo de mantenimiento duplicado

Las dos versiones traían una implementación de HAB-06:

| | Versión del grupo (`mantenimiento`) | Versión individual (`housekeeping`) |
|---|---|---|
| Endpoints | 3 | 8 |
| Reglas de negocio | dentro del service | módulo aparte, con 22 pruebas |
| Limpieza posterior al check-out | no contemplada | resuelta con "Marcar limpia" |
| Pantalla propia | no | sí |

Se conservó **housekeeping** por cobertura y porque incluye el caso que deja
habitaciones trabadas: el check-out las pasa a LIMPIEZA sin abrir un bloqueo,
así que no hay nada que cerrar y sin esa acción no vuelven a estar disponibles.

`/api/mantenimiento` quedó como **alias** de `/api/housekeeping`, de modo que
cualquier código que todavía apunte ahí sigue funcionando. Los helpers
`registrarMantenimiento`, `cerrarMantenimiento` y `getMantenimientosActivos` de
`lib/api.ts` se reapuntaron al módulo unificado, con un traductor de nombres
para no tocar los componentes que ya los usaban.

### Nombres de relación de Prisma

El grupo renombró campos de relación en `schema.prisma`: `employee_opened` en
lugar de `opened_by_employee`, `maintenances` en lugar de `room_maintenance`.
Como ese archivo es compartido y varios módulos dependen de esos nombres, **se
adaptó HU-9 al schema del grupo**, no al revés.

### Columnas generadas repuestas

El `schema.prisma` del grupo había perdido tres campos que la base sí calcula:

| Campo | Tabla |
|---|---|
| `nights` | `reservation` |
| `total_amount` | `reservation` |
| `subtotal` | `purchase_order_detail` |

Se declararon **opcionales y de solo lectura**. Se pueden leer; enviarlas en un
`create` o un `update` hace que PostgreSQL rechace la operación.

### Código eliminado

| Qué | Por qué |
|---|---|
| `backend/src/controllers/`, `routes/`, `services/` | Estructura anterior a la modular; ningún archivo los importaba |
| `backend/src/utils/index.js` | Copia vieja del entry point de Express |
| `backend/index.js` | Segundo entry point; el bueno es `src/server.js` |
| `backend/prisma.config.ts`, `skills-lock.json` | Configuración que ya no se usa |
| `backend/pnpm-lock.yaml`, `pnpm-workspace.yaml`, `frontend/pnpm-lock.yaml` | El proyecto se instala con npm; dos lockfiles distintos llevan a versiones distintas por máquina |
| `frontend/tsconfig.tsbuildinfo` | Caché de compilación |
| `navegacion.ts.backup`, `app.js.backup` | Copias de respaldo dentro del código |
| `ESTRUCTURA_COMPLETA.txt` | Listado que quedaba desactualizado en cada commit |
| `backend/.env` | Tenía credenciales reales. Se entrega solo `.env.example` |

---

## Decisiones que conviene revisar con el equipo

### 1. Las migraciones de Prisma se eliminaron

La versión del grupo traía `backend/prisma/migrations/` con una migración
generada desde el schema. Ese archivo crea las 38 tablas, pero **no contiene
nada de la lógica de negocio**:

| | Script SQL | Migración de Prisma |
|---|---|---|
| Triggers | 20 | 0 |
| Funciones | 23 | 0 |
| Vistas | 9 | 0 |
| Restricciones EXCLUDE | 4 | 0 |
| Columnas generadas | 2 | 0 |

Aplicada sobre una base limpia, la aplicación arranca pero pierde en silencio
todo lo que la sostiene: se pueden sobrevender habitaciones, el estado de los
comprobantes deja de actualizarse, el check-in y el check-out no mueven el
estado de la habitación, y los endpoints que consultan vistas
(`fn_available_rooms`, `v_room_type_panel`, `v_supplier_voucher_balance`) fallan
porque esas vistas no existen.

Tener dos fuentes de verdad para la base es lo que más problemas trajo en los
sprints anteriores. **El script SQL es la fuente de verdad**; `schema.prisma` se
mantiene a mano, en espejo. Por eso también se quitó `prisma:pull` de los
scripts de npm: ese comando reescribe el schema y se lleva puestos los nombres
de relación, las columnas generadas y los EXCLUDE.

Si el equipo prefiere trabajar con migraciones de Prisma, hay que portar a mano
triggers, vistas y restricciones a cada migración. Es una decisión para tomar en
conjunto, no algo que convenga resolver dentro de un merge.

### 2. Nombre de la base de datos

Las dos versiones no coincidían: una usa `sistema_hotelero_db` y la otra
`db_hotel`. Se unificó en **`sistema_hotelero_db`**, que es el que figura en
todos los scripts y en la documentación.

Quien tenga la base con el otro nombre puede renombrarla:

```sql
ALTER DATABASE db_hotel RENAME TO sistema_hotelero_db;
```

O cambiar su `.env` local. Lo importante es que todos usen el mismo.

### 3. Pendiente de coordinación en HU-9

`fn_available_rooms()` y `fn_validate_reservation()` descartan una habitación
con cualquier bloqueo abierto, incluida una limpieza. Una habitación que se está
limpiando hoy no aparece en la búsqueda de disponibilidad para hoy, y en un
hotel eso no corresponde: se limpia a la mañana y se entrega a las 14 h.

La corrección es agregar `AND rm.maintenance_type <> 'LIMPIEZA'` en ambas
funciones. No se aplicó porque son de RES-05 y RES-01; conviene que lo haga
quien las escribió. Está detallado en `docs/HU-9_HAB-06_Housekeeping.md`.

### 4. Job diario

Dos funciones necesitan ejecutarse una vez por día y hoy nadie las llama:

```sql
SELECT fn_process_no_shows();               -- RES-09
SELECT fn_activate_scheduled_maintenance(); -- HU-9
```

Conviene definir un solo job para las dos.

---

## Endpoints

| Módulo | Base |
|---|---|
| Stock | `/api/stock`, `/api/articulos`, `/api/categorias`, `/api/depositos`, `/api/tipos-movimiento` |
| Proveedores | `/api/proveedores`, `/api/comprobantes`, `/api/tipos-comprobante`, `/api/condiciones-fiscales` |
| Compras y pagos | `/api/ordenes-compra`, `/api/ordenes-pago`, `/api/metodos-pago`, `/api/cuenta-corriente` |
| Habitaciones | `/api/habitaciones`, `/api/tipos-habitacion`, `/api/tarifas`, `/api/panel-habitaciones`, `/api/servicios-habitacion` |
| Reservas | `/api/reservas` |
| Housekeeping | `/api/housekeeping` (alias: `/api/mantenimiento`) |

Todas las respuestas tienen la forma `{ ok, data, message }`. Los errores traen
`message` con un texto presentable al usuario.

---

## Pruebas

```powershell
cd backend
npm test
```

22 pruebas unitarias sobre las reglas de housekeeping. Son lógica pura: no
necesitan base de datos.

El resto de los módulos todavía no tiene pruebas automatizadas. Es el pendiente
más grande del proyecto: hoy cada regresión se detecta a mano.
