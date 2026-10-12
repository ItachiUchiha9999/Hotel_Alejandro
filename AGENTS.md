# AGENTS.md — Hotel Alejandro I (SIGH)

Sistema de gestión hotelera. El código, los comentarios, los commits y los
mensajes de error al usuario están **en español**: mantené ese idioma.

## Estructura

No es un workspace: `backend/` y `frontend/` se instalan y corren por separado.

- `backend/` — Node.js + Express 4 + Prisma 5 (CommonJS) sobre PostgreSQL 17.
  Entry point: `src/server.js`. Todas las rutas se montan en `src/app.js`.
  Módulos en `src/modules/<nombre>/<nombre>.{routes,controller,service}.js`.
- `frontend/` — Next.js 16 (App Router) + React 19 + TS + Tailwind v4.
  Páginas en `src/app/<modulo>/`, cliente HTTP en `src/lib/api.ts`.
- `database/` — scripts SQL numerados; **son la fuente de verdad del esquema**.
- `docs/` — documentación por sprint/HU (en español).

## Comandos

```powershell
# Backend (puerto 4000)
cd backend; npm.cmd ci; npx.cmd prisma generate
npm.cmd run dev      # node --watch
npm.cmd test         # node --test tests/**/*.test.js

# Frontend (puerto 3000)
cd frontend; npm.cmd ci; npm.cmd run build; npm.cmd run dev
```

- Usar **npm con `npm ci`** (hay `package-lock.json`). No usar pnpm: los
  lockfiles de pnpm se eliminaron a propósito.
- En PowerShell, si la política de ejecución bloquea los `.ps1`, usar
  `npm.cmd` / `npx.cmd`.
- Una sola prueba: `node --test tests/housekeeping.reglas.test.js` (desde `backend/`).
- Requisito previo al primer `npm run dev` del backend: copiar `.env.example` a
  `.env` y completar `DATABASE_URL`, y correr `npx prisma generate` (si falta,
  el error es `@prisma/client did not initialize`).

## Base de datos: reglas duras

- **Nunca** usar `prisma db push`, `prisma migrate` ni `prisma db pull`. Los
  scripts SQL crean triggers, funciones, vistas y restricciones EXCLUDE que
  Prisma no reproduce; `db pull` destruye el schema mantenido a mano.
  `backend/prisma/schema.prisma` se edita **a mano, en espejo** de los SQL, y
  después se corre `npx prisma generate`.
- Base de datos: `sistema_hotelero_db`. Instalación nueva:
  `psql -U postgres -d sistema_hotelero_db -f database/instalar.sql`
  (**borra datos existentes**: solo en bases nuevas). En bases existentes,
  aplicar solo los parches numerados que falten (`database/11_*.sql` … `19_*.sql`).
- Una instalación nueva tiene **44 tablas** (verificación en README).
- Columnas generadas de solo lectura (leer sí, enviar en create/update hace
  fallar la operación): `reservation.nights`, `reservation.total_amount`,
  `purchase_order_detail.subtotal`.

## Pruebas

- `npm test` corre todo con `node --test`. Las pruebas de housekeeping son
  lógica pura (sin base de datos).
- Los archivos `*.integration.test.js` **se saltean** si no está definida
  `TEST_DATABASE_URL`, y exigen que el nombre de la base empiece con
  `hotel_s3_test_` (protección contra correr sobre la base real).

## Convenciones del backend

- Respuestas: `{ ok, data, message }`; los errores llevan `message`
  presentable al usuario.
- Solo `src/config/env.js` lee `process.env`; no leer `process.env` en otros
  archivos.
- `/api/mantenimiento` es un **alias** de `/api/housekeeping`: los cambios en
  housekeeping deben funcionar en ambas rutas.
- `DEFAULT_EMPLOYEE_ID` (env) se usa como empleado mientras no haya login real.

## Convenciones del frontend

- `NEXT_PUBLIC_API_URL` apunta al backend **sin `/api` al final**.
- Usuario de prueba: `admin` / `1234`.
- Si cambia el puerto/origen del frontend, agregarlo a `CORS_ORIGINS` en
  `backend/.env`.

## Pendientes conocidos (no "arreglar" sin coordinar)

- `fn_available_rooms()` y `fn_validate_reservation()` excluyen habitaciones en
  LIMPIEZA; la corrección (`AND rm.maintenance_type <> 'LIMPIEZA'`) está
  documentada en `docs/HU-9_HAB-06_Housekeeping.md` pero reservada a quien
  escribió esas funciones.
- Las funciones diarias `fn_process_no_shows()` y
  `fn_activate_scheduled_maintenance()` no tienen job que las llame.
