# Estructura base del Frontend — SIGH · Hotel Alejandro I

**Sprint 1 — Módulo STK (Stock e Insumos)**

Este documento y los archivos que lo acompañan son el **estándar del equipo de Frontend**.
Todos partimos del mismo layout, los mismos colores, la misma tipografía y los mismos
componentes, así cada funcionalidad (STK-01 a STK-07) se ve como parte del mismo sistema
aunque la desarrolle una persona distinta.

Regla corta: **nadie inventa estilos ni estructura. Se copia la pantalla de referencia y se cambia el contenido.**

---

## 1. Estructura de carpetas

Así queda `frontend/` después de aplicar esta base:

```
frontend/
├── app/
│   ├── globals.css              ← estilos base (NO tocar)
│   ├── layout.tsx               ← layout maestro: header + menú (NO tocar)
│   ├── page.tsx                 ← pantalla de inicio
│   └── stock/
│       ├── depositos/page.tsx           ← STK-01  (pantalla de referencia)
│       ├── articulos/page.tsx           ← STK-02
│       ├── existencias/page.tsx         ← STK-03
│       ├── tipos-movimiento/page.tsx    ← STK-04
│       ├── movimientos/page.tsx         ← STK-05
│       ├── transferencias/page.tsx      ← STK-06
│       └── historial/page.tsx           ← STK-07
│
├── components/
│   ├── layout/                  ← cascarón de la app (NO tocar)
│   │   ├── AppShell.tsx
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Isotipo.tsx
│   │   └── PageHeader.tsx
│   │
│   ├── ui/                      ← componentes compartidos (cambios se avisan al grupo)
│   │   ├── Button.tsx   Card.tsx   Field.tsx   Input.tsx   Select.tsx
│   │   ├── Table.tsx    Badge.tsx  InfoBox.tsx EmptyState.tsx
│   │   └── index.ts
│   │
│   └── stock/                   ← acá trabaja cada uno, en SU carpeta
│       ├── depositos/           ← STK-01
│       ├── articulos/           ← STK-02
│       └── ...
│
├── lib/
│   ├── api.ts                   ← cliente HTTP único
│   ├── types.ts                 ← tipos compartidos
│   ├── navegacion.ts            ← mapa del menú lateral
│   └── cn.ts                    ← utilidad para unir clases
│
├── public/
│   ├── logo-header.svg
│   └── isotipo.svg
│
└── tailwind.config.ts           ← colores y fuentes oficiales
```

### Cambio respecto de lo que hay hoy

La carpeta actual `app/depositos/` pasa a **`app/stock/depositos/`**. Es el único movimiento
necesario y conviene hacerlo ahora, antes de que existan siete pantallas.
Motivo: agrupa todo el Sprint 1 bajo la ruta `/stock`, hace que el submenú del módulo funcione
solo, y deja libre el primer nivel de `app/` para los módulos de los próximos sprints
(Reservas, Habitaciones, Clientes…).

### Cómo evitamos pisarnos en Git

| Zona | Quién la toca |
|---|---|
| `app/stock/<mi-funcionalidad>/` | solo su responsable |
| `components/stock/<mi-funcionalidad>/` | solo su responsable |
| `components/ui/`, `components/layout/`, `tailwind.config.ts`, `app/layout.tsx`, `app/globals.css` | nadie por su cuenta: se avisa al grupo y se hace en una rama aparte |
| `lib/types.ts`, `lib/navegacion.ts` | se agregan líneas, no se reordena el archivo |

Cada uno trabaja en su rama `feature/STK-0X-<nombre>` y mergea a `develop`.

---

## 2. Sistema de diseño

### 2.1 Colores

Salen todos de `tailwind.config.ts`. **Prohibido escribir hexadecimales sueltos en el JSX.**

| Uso | Clase Tailwind | Hex |
|---|---|---|
| Sidebar, textos de máxima jerarquía | `carbon` | `#26333B` |
| Barra superior | `carbon-dark` | `#1A242B` |
| Botón primario, ítem de menú activo, iconografía | `gold` | `#CBA45C` |
| Hover del botón primario | `gold-dark` | `#B08D48` |
| Fondo del área de trabajo | `bone` | `#F4EFE4` |
| Interior de cards y formularios | `white` | `#FFFFFF` |
| Bordes de cards, tablas e inputs | `line` | `#E3DDD0` |
| Estado correcto / activo | `success` | `#3F7A5E` |
| Error / eliminar | `danger` | `#B3453C` |
| Advertencia | `warning` | `#C08A34` |
| Mensajes de regla del sistema | `info` | `#3D6B87` |

Ejemplos: `bg-carbon`, `text-gold`, `border-line`, `bg-bone`.
Para transparencias se usa la sintaxis de Tailwind: `bg-white/10`, `text-carbon/60`.

### 2.2 Tipografía

Dos familias, cargadas con `next/font/google` en `app/layout.tsx` y expuestas como variables CSS:

- **`font-serif` → Playfair Display** (fallback `Georgia`, `Times New Roman`).
  Solo para: la marca en el header, títulos de página (`PageHeader`) y títulos de card.
  Nunca para datos, labels ni botones.
- **`font-sans` → Inter** (fallback `system-ui`).
  Todo lo demás: labels, inputs, tablas, menús, botones, textos descriptivos.

Escala de tamaños que usamos:

| Elemento | Clases |
|---|---|
| Título de página | `font-serif text-3xl` |
| Título de card | `font-serif text-lg` |
| Miga de pan / eyebrow (`STK-01 · SPRINT 1`) | `text-[0.65rem] uppercase tracking-[0.22em] text-gold-dark` |
| Label de campo | `text-xs uppercase tracking-wide text-carbon/70` |
| Texto de tabla y formulario | `text-sm` |
| Ayuda y notas al pie | `text-xs text-carbon/50` |

Si el proyecto tiene una carpeta `app/fonts/` de `create-next-app` (Geist), se puede borrar:
las fuentes ahora se cargan desde `app/layout.tsx`.

### 2.3 Layout

```
┌───────────────────────────────────────────────────────┐
│ HEADER  ▸ isotipo + "Hotel Alejandro I" SIGH · buscador · avatar │  h-16, bg-carbon-dark
├──────────┬────────────────────────────────────────────┤
│ SIDEBAR  │  ÁREA DE TRABAJO                           │
│ w-64     │  bg-bone · max-w-5xl centrado · p-8        │
│ bg-carbon│                                            │
│          │  ┌──────────────────────────────────────┐  │
│ MÓDULOS  │  │ STK-01 · SPRINT 1                    │  │  ← PageHeader
│ • Reservas│ │ Depósitos                            │  │
│ • ...    │  │ subtítulo explicativo                │  │
│ ▸ Stock  │  └──────────────────────────────────────┘  │
│   Depósitos│ ┌──────────────────────────────────────┐  │
│   Artículos│ │ Card blanca: formulario              │  │
│   ...    │  └──────────────────────────────────────┘  │
│          │  ┌──────────────────────────────────────┐  │
│          │  │ Card blanca: tabla                   │  │
│          │  └──────────────────────────────────────┘  │
└──────────┴────────────────────────────────────────────┘
```

- El header y el menú los monta `app/layout.tsx` **una sola vez**. Tu pantalla nunca los dibuja.
- El ítem activo del menú lleva fondo `bg-white/10` y su viñeta se pone dorada.
- Dentro del módulo activo se despliega el submenú con las historias de usuario.
- En pantallas chicas el menú se convierte en un panel lateral que abre el botón ☰ del header.

---

## 3. Componentes disponibles

Se importan todos desde `@/components/ui`.

| Componente | Para qué |
|---|---|
| `<Button variante="primario \| secundario \| fantasma \| peligro" tamano="sm \| md" cargando>` | Toda acción. El primario dorado es uno solo por pantalla. |
| `<Card titulo descripcion acciones>` + `<CardFooter>` | Contenedor blanco de formularios y tablas. |
| `<Field label error ayuda requerido>` + `<FieldGrid>` | Campo de formulario con label, error y ayuda. Grilla de 2 columnas. |
| `<Input invalido>` / `<Select invalido>` | Controles de carga. |
| `<Table> <THead> <TH> <TBody> <TR> <TD>` | Tablas de datos. |
| `<Badge tono="activo \| inactivo \| info \| alerta">` | Estados (Activo/Inactivo, tipo de movimiento…). |
| `<InfoBox tipo="regla \| error \| exito">` | Reglas automáticas del sistema y respuestas del backend. |
| `<EmptyState titulo descripcion accion>` | Cuando no hay datos todavía. |
| `<PageHeader eyebrow titulo descripcion acciones>` | Encabezado de vista (desde `@/components/layout/PageHeader`). |

---

## 4. Cómo agregar tu pantalla

1. Copiá `app/stock/depositos/page.tsx` a `app/stock/<tu-ruta>/page.tsx`.
2. Copiá `components/stock/depositos/` a `components/stock/<tu-funcionalidad>/` y renombrá.
3. Cambiá el `eyebrow` del `PageHeader` por tu código (`STK-04 · Sprint 1`) y el título.
4. Agregá tus tipos en `lib/types.ts` (una sección nueva al final, no toques las de otros).
5. Consumí el backend **siempre** con `api.get/post/put/delete` de `@/lib/api`.
6. Verificá tu ruta en `lib/navegacion.ts` (ya están las siete cargadas).

### Checklist antes de mergear a `develop`

- [ ] No escribí ningún color hexadecimal en el JSX.
- [ ] Usé `PageHeader` con el código de mi historia de usuario.
- [ ] Todo formulario y toda tabla están dentro de una `Card`.
- [ ] Los campos usan `Field` + `Input`/`Select`, no `<label>` sueltos.
- [ ] Manejo error del backend con `InfoBox tipo="error"` y lista vacía con `EmptyState`.
- [ ] La pantalla se ve bien en el celular (probar el ancho del navegador al mínimo).
- [ ] Se puede navegar con Tab y se ve el foco.

---

## 5. Textos de la interfaz

Pequeñas reglas para que todas las pantallas hablen igual:

- Botones en infinitivo y con el objeto: **Guardar depósito**, **Registrar movimiento**, **Exportar historial**. Nunca "Enviar" ni "Aceptar".
- Sentence case en todos lados: "Registrar movimiento de stock", no "Registrar Movimiento De Stock".
- Los errores dicen qué pasó y cómo se arregla: "Ya existe un depósito con ese nombre. Elegí otro." No "Error 400".
- Las reglas automáticas se explican antes de que el usuario guarde, con `InfoBox tipo="regla"`.
- Nombramos las cosas como el hotel las llama: depósito, insumo, movimiento, huésped. No "registro", "entidad" ni "ítem".

---

## 6. Configuración necesaria

**`tsconfig.json`** — debe tener el alias `@/` (si el proyecto se creó con `create-next-app`, ya está):

```json
{
  "compilerOptions": {
    "paths": { "@/*": ["./*"] }
  }
}
```

**`frontend/.env.local`** (no se sube a GitHub):

```
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

**Dependencias**: ninguna nueva. Todo se resuelve con Next.js, React, TypeScript y Tailwind,
que ya están en el proyecto.

**Frontend en el puerto 3001** para no chocar con el backend:

```json
"scripts": { "dev": "next dev -p 3001" }
```
