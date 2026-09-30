# Hotel Alejandro I — Sistema de Gestión de Stock (SIGH)

Módulo de stock e insumos del sistema de gestión hotelera: depósitos, catálogo de
artículos, movimientos (ingreso, egreso, transferencia) y reportes de saldo.

- **Backend:** Node.js + Express + Prisma sobre PostgreSQL
- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4

---

## Cómo levantarlo

### 1. Base de datos

```bash
createdb sistema_hotelero_db

psql -U postgres -d sistema_hotelero_db -f database/01_schema.sql
psql -U postgres -d sistema_hotelero_db -f database/02_seed.sql
```

En Windows, si `psql` no se reconoce, agregá las herramientas al PATH de la
sesión antes de correr los comandos:

```powershell
$env:Path += ";C:\Program Files\PostgreSQL\17\bin"
```

> Si ya tenías la base cargada con el esquema viejo (el del `type_operation_enum`)
> y no querés perder los datos, corré `database/03_migracion_desde_enum.sql` en
> lugar de los dos scripts anteriores.

### 2. Backend

```bash
cd backend
cp .env.example .env        # completá DATABASE_URL con tu contraseña
npm install
npx prisma generate         # obligatorio: sin esto el cliente no existe
npm run dev
```

Queda escuchando en `http://localhost:4000`.
Para probar que arrancó bien: `http://localhost:4000/api/health`

### 3. Frontend

En otra terminal:

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Queda en `http://localhost:3000`. Usuario de prueba del login: `admin` / `1234`.

---

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/health` | Estado del servicio |
| GET | `/api/depositos` | Lista de depósitos (`?activos=true` filtra) |
| POST | `/api/depositos` | Crea un depósito |
| GET | `/api/depositos/:id` | Trae un depósito |
| PUT | `/api/depositos/:id` | Actualiza un depósito |
| PATCH | `/api/depositos/:id/estado` | Activa o desactiva |
| GET | `/api/articulos` | Catálogo de artículos |
| POST | `/api/articulos` | Alta de artículo |
| PUT | `/api/articulos/:id` | Edita la ficha |
| PATCH | `/api/articulos/:id/estado` | Baja lógica |
| GET | `/api/categorias` | Categorías |
| GET | `/api/stock` | Saldo consolidado |
| GET | `/api/stock/deposito/:id` | Stock de un depósito |
| GET | `/api/stock/tipos-movimiento` | Tipos activos |
| GET | `/api/stock/movimientos` | Historial (`?deposito=&tipo=`) |
| POST | `/api/stock/movimientos` | Registra un movimiento |
| GET | `/api/stock/movimientos/exportar` | Descarga el historial en Excel |
| GET | `/api/tipos-movimiento` | Tipos de movimiento (ABM completo) |
| POST | `/api/tipos-movimiento` | Crea un tipo |
| PUT | `/api/tipos-movimiento/:id` | Edita descripción y efecto |
| PATCH | `/api/tipos-movimiento/:id/estado` | Activa o desactiva |
| GET | `/api/catalogo/stocks` | Stocks con artículo y depósito |
| GET | `/api/catalogo/employees` | Empleados activos |
| GET | `/api/catalogo/deposits` | Depósitos activos |

Alias en inglés que mantienen andando las pantallas de la rama STK-04/STK-05:
`/api/movement-types`, `/api/catalog/*`, `/api/deposits` y
`POST /api/stock-movements`.

Toda respuesta tiene la misma forma: `{ ok, data, message }`. Los errores traen
siempre `message` con un texto presentable al usuario.

### Payload de un movimiento

```json
{
  "movement_type_id": 1,
  "details": [
    { "article_code": "FRI-001", "amount": 12 },
    { "article_code": "FRI-002", "amount": 6 }
  ],
  "deposit_origin_id": null,
  "deposit_destination_id": 4,
  "supplier_id": 3,
  "observations": "Factura A-000123"
}
```

Un movimiento puede llevar varios artículos bajo una misma cabecera. Si falla
cualquier renglón, se revierte el movimiento completo. También se acepta la
forma corta de un solo artículo (`article_code` + `amount` en la raíz).

Qué depósitos son obligatorios lo decide el `effect` del tipo elegido:

| Efecto | Origen | Destino |
|---|---|---|
| `SUMA` | — | obligatorio |
| `RESTA` | obligatorio | — |
| `TRANSFERENCIA` | obligatorio | obligatorio y distinto del origen |

---

## Cambios clave del refactor

### Errores que impedían que el proyecto arrancara

1. **El frontend no compilaba.** Las pantallas importaban `@/lib/cn`, `@/lib/api`,
   `@/lib/types` y `@/lib/navegacion`, pero la carpeta `src/lib` no existía en el
   repositorio. También se importaba `lucide-react`, que no estaba en las
   dependencias. Se creó la capa `lib` y se reemplazó el ícono por un SVG propio.

2. **Los estilos de marca no se aplicaban.** El proyecto usa Tailwind v4, donde el
   tema se define en CSS con `@theme`, pero los colores estaban en un
   `tailwind.config.ts` con formato de v3, que Tailwind ignoraba. Clases como
   `bg-carbon`, `text-gold` o `border-line` no generaban ningún estilo. Los tokens
   se migraron a `globals.css` y se eliminó el config obsoleto.

3. **Tres puntos de entrada distintos en el backend.** `backend/index.js`,
   `src/index.js` y `src/server.js` levantaban servidores en puertos distintos y
   cada uno montaba solo una parte de la API, así que siempre quedaba la mitad de
   las pantallas contra un 404. Ahora hay un único `src/server.js` → `src/app.js`
   que monta todos los módulos.

4. **Puertos cruzados.** Unas pantallas llamaban al 3000 y otras al 4000. Ahora
   todas usan `NEXT_PUBLIC_API_URL`.

5. **El módulo de artículos rompía al importarse:** `articulo.model.js` hacía
   `require('../config/db')`, un archivo que no existe en el repo, y consultaba
   columnas (`article_number`, `article_compound_name`) que no estaban en la base.
   Se reescribió sobre Prisma y se agregaron esas columnas al esquema.

6. **El tipo AJUSTE creaba movimientos fantasma.** El service mapeaba
   `AJUSTE → EGRESO` para buscar el tipo, pero después comparaba contra el string
   original, así que no entraba a ninguna rama: no tocaba el stock, no creaba
   detalle, y aun así respondía "registrado con éxito". Ahora la dirección la
   decide la columna `effect` del tipo, y `AJUSTE_POSITIVO` / `AJUSTE_NEGATIVO`
   existen como tipos reales en la base.

### Correcciones de datos y concurrencia

7. **`deposit_origin_id` era NOT NULL**, así que un ingreso de proveedor guardaba
   el depósito de *destino* en la columna de *origen*. La columna pasó a ser
   opcional y se corrigieron los registros existentes en la migración.

8. **Condición de carrera en el stock.** El patrón era leer, calcular en
   JavaScript y escribir, con lo que dos movimientos simultáneos sobre el mismo
   artículo se pisaban. Ahora se usan `increment` / `decrement` atómicos, y la
   resta va con un UPDATE condicional que falla limpio si no hay saldo.

9. **Las transferencias no registraban el lado destino.** El detalle guardaba un
   solo `stock_id`. Ahora se crea una fila por cada fila de stock afectada.

10. **Los CHECK y las reglas de negocio viven en la base:** stock no negativo,
    cantidad positiva, efecto válido, y triggers que validan la coherencia entre
    el efecto y los depósitos y que rechazan depósitos inactivos.

### Estructura

11. **Backend por módulos.** Cada módulo tiene `routes` → `controller` → `service`.
    Los controllers no consultan Prisma directamente; los services no conocen
    `req` ni `res`.

12. **Un solo cliente Prisma.** Había dos módulos duplicados (`db/prisma.js` y
    `utils/prisma.js`) que abrían dos pools contra la misma base.

13. **Manejo de errores centralizado**, con códigos HTTP reales: 404 para
    inexistente, 409 para conflicto de negocio, 400 para datos inválidos. Antes
    todo salía como 500 con `Error` genérico.

14. **Un solo árbol de componentes.** Convivían `frontend/components/` y
    `frontend/src/components/`; se unificó en `src/components/` y se corrigió el
    nombre de la carpeta `layaout` → `layout`.

15. **Navegación unificada.** El menú anterior apuntaba a `/deposits`, `/articles`,
    `/reports` y `/stock/movement-types`, rutas que nunca existieron: todos esos
    enlaces daban 404. Ahora el menú sale de `src/lib/navegacion.ts` y solo lista
    pantallas que existen.

16. **El layout usaba un `SliderBar` propio** y el sistema de diseño
    (`AppShell`, `Header`, `Sidebar`) era código muerto. Se invirtió: el layout
    delega en `AppShell`, que además decide cuándo mostrar la pantalla limpia del
    login.

17. **La página de inicio era una copia de `/articulos`** (35 KB duplicados, con su
    propio estado y sus propios fetch). Se reemplazó por un panel con accesos,
    artículos bajo mínimo y últimos movimientos.

18. **Se eliminaron los depósitos ficticios.** Si la API fallaba, el formulario de
    movimientos mostraba dos depósitos inventados con ID 1 y 2 y dejaba cargar
    contra ellos. Ahora muestra el error y bloquea el formulario.

19. **El catálogo de artículos duplicaba el menú.** La pantalla renderizaba su
    propio sidebar y su propia cabecera de marca, así que quedaba superpuesta al
    `AppShell`. Ese menú interno además enlazaba a "Tipos de movimiento" y
    "Reportes", pantallas que no existen. Se reescribió con el sistema de diseño
    y se eliminó el botón "Importar CSV", que no tenía ninguna función detrás.

20. **El catálogo leía mal la respuesta de la API.** Esperaba un array pelado y el
    backend devuelve `{ ok, data }`, así que fallaba con "la respuesta del
    servidor no tiene el formato esperado" aunque la conexión estuviera bien.

21. **Doble barra de scroll en Stock por depósito**, por un `h-screen` dentro del
    `AppShell`, que ya define el alto del área de trabajo.

---

## Integración de las ramas STK-04 y STK-05

La rama traía un backend propio en TypeScript (ESM, Prisma 7 con driver adapter,
puerto 3001) y dos pantallas sueltas sobre un Next.js recién scaffoldeado. Se
portaron sus funcionalidades a la arquitectura del proyecto en lugar de sumar un
segundo servidor: había dos backends escuchando en puertos distintos, cada uno
con la mitad de la API.

**Lo que se incorporó de la rama:**

- **ABM completo de tipos de movimiento (STK-04).** Antes solo se listaban; ahora
  se pueden crear, editar y activar/desactivar desde `/stock/tipos-movimiento`.
- **Movimientos con varios artículos (STK-05).** El formulario permite cargar un
  renglón por artículo y todos viajan bajo una misma cabecera, de forma atómica.
- **Endpoints de catálogo** (`stocks`, `employees`, `deposits`) que usaban sus
  pantallas para poblar selectores.

**Problemas de la rama que se corrigieron al integrar:**

22. **STK-04 y STK-05 estaban desconectados.** En su esquema, `movement_type` era
    una tabla suelta sin relación con `stock_movement`, que seguía usando el
    `type_operation_enum`. Crear un tipo nuevo desde la ABM no servía de nada: el
    motor de movimientos no podía usarlo. Acá el tipo se referencia por FK y su
    `effect` es lo que decide la dirección, así que un tipo nuevo funciona al
    instante.

23. **`movement_type` no existía en el script SQL** de la rama, solo en su
    `schema.prisma`. Quien clonara el repo y corriera el script se quedaba sin
    esa tabla.

24. **Validación de efecto inconsistente.** Al crear un tipo se rechazaba
    `TRANSFERENCIA`, pero al editarlo se aceptaba. Ahora los tres efectos valen
    en ambas operaciones.

25. **Se podía cambiar el efecto de un tipo ya usado**, lo que reinterpretaba
    todo el histórico: un egreso pasaba a leerse como ingreso y los saldos
    quedaban sin explicación. Ahora se bloquea si el tipo tiene movimientos.

26. **Las cantidades tenían que ser enteras** (`Number.isInteger`), pero la base
    usa `NUMERIC(12,2)`. No se podían cargar 2,5 litros de detergente.

27. **Los ingresos guardaban el depósito en la columna de origen**, con la
    semántica vieja. Se normalizó a la regla por efecto.

28. **La resta de stock leía y después escribía**, con la condición de carrera ya
    corregida en el resto del sistema. Se unificó con el `UPDATE` condicional.

29. **Errores sin código HTTP:** todo salía como 400 o 500 con `Error` genérico.
    Ahora pasan por el manejador central con 404 / 409 / 400 según el caso.

---

## Pendientes

- **Login real (STK-06).** El acceso es una comparación fija contra `admin/1234` en
  el cliente y la sesión es un flag en `localStorage`. Mientras tanto, los
  movimientos se atribuyen al empleado de `DEFAULT_EMPLOYEE_ID`. Falta autenticar
  contra la tabla `employees` con JWT y mover la contraseña de `roles` a
  `employees`: hoy es por rol, o sea compartida entre personas.
- **Selector de proveedor** en el alta de movimientos. El backend ya acepta y
  guarda `supplier_id`, pero el formulario todavía no lo ofrece.
- **Movimientos multi-artículo.** La base lo soporta (`movement_stock_detail` es
  una tabla aparte); el formulario carga un artículo por movimiento.
- **Tests.** No hay ninguno.
