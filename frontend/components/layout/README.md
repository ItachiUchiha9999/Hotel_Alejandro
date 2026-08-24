

Sigue estos 2 simples pasos:

1. Ve a la carpeta principal de tu proyecto (justo afuera de las carpetas `frontend` y `backend`).
2. Crea un archivo nuevo, ponle el nombre **`README.md`** y pégale exactamente este código adentro:

```markdown
# 🏨 Sistema Integral de Gestión Hotelera (SIGH)
**Hotel Alejandro I - Módulo de Stock e Insumos (Sprint 1)**

Bienvenido al repositorio del Sistema Integral de Gestión Hotelera (SIGH). Este proyecto es una aplicación web full-stack diseñada para centralizar y optimizar las operaciones del Hotel Alejandro I. 

Este repositorio cubre el desarrollo del **Sprint 1**, enfocado exclusivamente en el **Módulo de Stock (STK)**.

---

## 🛠️ Tecnologías Utilizadas

### Frontend
*   **Framework:** Next.js (App Router)
*   **Librería UI:** React
*   **Estilos:** Tailwind CSS
*   **Iconos:** Lucide React
*   **Lenguaje:** TypeScript

### Backend
*   **Entorno:** Node.js
*   **Framework:** Express
*   **ORM:** Prisma
*   **Base de Datos:** PostgreSQL

---

## 🚀 Requisitos Previos

Asegúrate de tener instalados los siguientes programas en tu máquina antes de comenzar:
*   Node.js (Versión 18 o superior recomendada).
*   PostgreSQL (Instalado y corriendo localmente).
*   Git.

---

## ⚙️ Instalación y Configuración Local

El proyecto está dividido en dos carpetas principales: `frontend` y `backend`. Debes configurar y ejecutar ambas por separado.

### 1. Configuración del Backend

1. Abre una terminal y navega a la carpeta del backend: `cd backend`
2. Instala las dependencias: `npm install`
3. Crea un archivo llamado `.env` en la raíz de la carpeta `backend` y agrega tu cadena de conexión a PostgreSQL:
   ```env
   PORT=3000
   DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/nombre_de_tu_base_de_datos?schema=public"

```

4. Inicializa Prisma y sincroniza la base de datos:
```bash
npx prisma generate
npx prisma db push

```


5. Inicia el servidor de desarrollo: `node --watch index.js`

### 2. Configuración del Frontend

1. Abre **otra** terminal y navega a la carpeta del frontend: `cd frontend`
2. Instala las dependencias: `npm install`
3. Inicia el servidor de desarrollo: `npm run dev`

---

## 🔐 Acceso al Sistema (Entorno de Desarrollo)

Para acceder al sistema localmente, la seguridad está simulada mediante validación en el cliente.

1. Ingresa a `http://localhost:3001/login`.
2. Utiliza las credenciales de prueba:
* **Usuario:** `admin`
* **Contraseña:** `1234`



---

## 🏗️ Convenciones de Diseño y Arquitectura (Frontend)

Para mantener la coherencia visual a lo largo del Sprint 1, todos los desarrolladores deben adherirse a la siguiente estructura base para las pantallas ABM (Alta, Baja, Modificación):

### Layout Estándar (Dos Columnas)

Las pantallas principales (ej. `STK-01 Depósitos`) deben utilizar CSS Grid para organizar la información:

* **Header:** `<PageHeader />` obligatorio.
* **Filtros:** Barra horizontal superior.
* **Contenido:** Grid `1.5fr / 1fr`.
* **Izquierda (1.5fr):** Tablas de listado y consulta.
* **Derecha (1fr):** Formularios de carga y edición (fijados con `sticky` para scroll independiente).



---

## 📂 Estructura del Sprint 1 (Tickets)

* **STK-01:** Gestión de depósitos.
* **STK-02:** Catálogo de artículos.
* **STK-03:** Consulta de existencias.
* **STK-04:** Tipos de movimiento.
* **STK-05:** Registro de movimientos.
* **STK-06:** Transferencias entre depósitos.
* **STK-07:** Historial de movimientos y auditoría.

```

*(Guárdalo y, si usas GitHub o GitLab, este archivo será la portada automática de tu proyecto).*

<FollowUp label="¿Avanzamos con el Backend?" query="¿Pudiste crear el archivo sin problemas? Si ya terminamos con toda esta configuración y documentación, ¿te parece que vayamos a configurar la base de datos en el backend para poder guardar depósitos reales?"/>

```
----------------------------------------------------
Aquí tienes el documento completo y unificado, formateado en Markdown. Está listo para que lo copies y lo pegues directamente en **Notion**, **Discord**, **Slack**, un documento de **Google Docs**, o incluso en el **README.md** de su repositorio en GitHub.

---

# 📄 Documentación Técnica: Unificación del Frontend (Sprint 1)

**Proyecto:** Sistema Integral de Gestión Hotelera (SIGH) - Hotel Alejandro I
**Módulo:** Stock e Insumos

Hola equipo 👋. Para asegurar que todos trabajemos sobre la misma base visual y arquitectónica durante el Sprint 1, implementamos una serie de mejoras en el Frontend.

**Objetivos de esta actualización:**

1. Proteger el sistema con una pantalla de Login aislada.
2. Mejorar la Barra Lateral (Sidebar) para que sea colapsable y funcione como acordeón (sin errores 404).
3. Reemplazar la pantalla vacía de inicio por un Dashboard operativo.
4. Establecer una estructura estándar de dos columnas (Grid) para las pantallas de ABM (Alta, Baja y Modificación).

A continuación, se encuentran los **4 archivos clave** que deben actualizar en sus entornos locales. Por favor, copien y peguen el código en las rutas indicadas.

---

### 1. El Cascarón y la Seguridad (AppShell)

**Ruta del archivo:** `frontend/components/layout/AppShell.tsx`

**¿Qué hace?** Intercepta la ruta `/login` para ocultar los menús y renderizar la pantalla completa. Además, implementa un "Guardia de Seguridad" con `useEffect` que verifica si existe la sesión en el navegador; si no, expulsa al usuario al Login.

```tsx
"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Guardia de seguridad
  useEffect(() => {
    const tieneSesion = localStorage.getItem("sesionIniciada");
    if (!tieneSesion && pathname !== "/login") {
      router.push("/login");
    }
  }, [pathname, router]);

  // Si es el Login, mostramos pantalla limpia
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Layout principal para el resto del sistema
  return (
    <div className="flex min-h-screen flex-col bg-bone">
      <Header
        onAbrirMenu={() => setMenuAbierto(true)}
        usuario={{ iniciales: "AC", nombre: "Andrada Camila" }}
      />
      <div className="flex flex-1">
        <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
        <main className="min-w-0 flex-1 px-4 py-8 md:px-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

```

---

### 2. Navegación Colapsable (Sidebar)

**Ruta del archivo:** `frontend/components/layout/Sidebar.tsx`

**¿Qué hace?** Agrega un botón hamburguesa (`Menu` de `lucide-react`) para encoger la barra lateral. Transforma los módulos principales (como "Stock") en botones de tipo acordeón que despliegan las opciones sin forzar una redirección.

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULOS } from "@/lib/navegacion";
import { cn } from "@/lib/cn";
import { Menu } from "lucide-react";

interface SidebarProps {
  abierto: boolean;
  onCerrar: () => void;
}

export function Sidebar({ abierto, onCerrar }: SidebarProps) {
  const pathname = usePathname();
  const [colapsado, setColapsado] = useState(false);
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});

  return (
    <>
      {abierto && (
        <div onClick={onCerrar} className="fixed inset-0 z-30 bg-carbon/60 lg:hidden" aria-hidden />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 shrink-0 overflow-y-auto border-r border-white/10 bg-carbon py-6 flex flex-col transition-all duration-300 ease-in-out motion-reduce:transition-none",
          colapsado ? "w-20 px-2" : "w-64 px-4",
          abierto ? "translate-x-0" : "-translate-x-full",
          "lg:sticky lg:top-16 lg:z-0 lg:h-[calc(100vh-4rem)] lg:translate-x-0"
        )}
      >
        <div className={cn("flex items-center pb-4", colapsado ? "justify-center" : "justify-between px-3")}>
          {!colapsado && <h2 className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-bone/40 transition-opacity">Módulos</h2>}
          <button onClick={() => setColapsado(!colapsado)} className="hidden lg:flex items-center justify-center p-1.5 rounded-md text-bone/50 hover:bg-white/10 hover:text-bone transition-colors">
            <Menu size={20} />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {MODULOS.map((modulo) => {
            const activo = pathname.startsWith(modulo.ruta);
            const tieneHijos = modulo.hijos && modulo.hijos.length > 0;
            const desplegado = expandidos[modulo.ruta] !== undefined ? expandidos[modulo.ruta] : activo;

            const clasesBase = cn(
              "w-full flex items-center rounded-lg py-2.5 text-sm transition-colors min-h-[40px]",
              colapsado ? "justify-center px-0" : "px-3 text-left",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold",
              activo ? "bg-white/10 font-medium text-bone" : "text-bone/55 hover:bg-white/5 hover:text-bone"
            );

            return (
              <div key={modulo.ruta}>
                {tieneHijos ? (
                  <button onClick={() => setExpandidos({ ...expandidos, [modulo.ruta]: !desplegado })} title={colapsado ? modulo.nombre : undefined} className={clasesBase}>
                    {!colapsado && <span>{modulo.nombre}</span>}
                  </button>
                ) : (
                  <Link href={modulo.ruta} onClick={onCerrar} aria-current={activo ? "page" : undefined} title={colapsado ? modulo.nombre : undefined} className={clasesBase}>
                    {!colapsado && <span>{modulo.nombre}</span>}
                  </Link>
                )}

                {!colapsado && desplegado && tieneHijos && (
                  <div className="ml-3 mt-1 flex flex-col gap-0.5 border-l border-white/10 pl-3">
                    {modulo.hijos!.map((hijo) => {
                      const hijoActivo = pathname === hijo.ruta;
                      return (
                        <Link key={hijo.ruta} href={hijo.ruta} onClick={onCerrar} aria-current={hijoActivo ? "page" : undefined} className={cn("rounded-md px-3 py-1.5 text-[0.8rem] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold", hijoActivo ? "text-gold" : "text-bone/45 hover:text-bone/80")}>
                          {hijo.nombre}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

```

---

### 3. Pantalla de Acceso (Login)

**Ruta del archivo:** `frontend/app/login/page.tsx`
*(Si la carpeta `login` no existe dentro de `app`, por favor créenla).*

**¿Qué hace?** Valida de forma local el ingreso. Las credenciales de prueba son Usuario: `admin` y Contraseña: `1234`. Al ingresar, guarda la variable `sesionIniciada` en el `localStorage` del navegador.

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (usuario === "admin" && password === "1234") {
      localStorage.setItem("sesionIniciada", "true");
      router.push("/"); 
    } else {
      setError("Usuario o contraseña incorrectos.");
    }
  };

  return (
    <div className="min-h-screen bg-carbon flex items-center justify-center p-4">
      <div className="bg-bone w-full max-w-md rounded-lg shadow-card p-10">
        <div className="text-center mb-10">
          <div className="text-xs font-serif tracking-[5px] text-gold mb-2">HOTEL</div>
          <h1 className="text-4xl font-serif text-carbon">ALEJANDRO I</h1>
          <div className="text-[9px] font-sans tracking-[2px] text-carbon/50 mt-3 uppercase">Sistema Integral de Gestión</div>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-6">
          {error && <div className="bg-danger/10 border border-danger text-danger text-sm p-3 rounded-md text-center">{error}</div>}
          <div>
            <label className="block text-[10px] font-sans tracking-[1.4px] text-carbon/60 mb-2 font-semibold">USUARIO</label>
            <input type="text" value={usuario} onChange={(e) => setUsuario(e.target.value)} className="w-full px-4 py-2.5 border border-line rounded-md focus:outline-none focus:border-gold bg-white text-carbon text-sm transition-colors" required />
          </div>
          <div>
            <label className="block text-[10px] font-sans tracking-[1.4px] text-carbon/60 mb-2 font-semibold">CONTRASEÑA</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2.5 border border-line rounded-md focus:outline-none focus:border-gold bg-white text-carbon text-sm transition-colors" required />
          </div>
          <button type="submit" className="w-full mt-2 bg-gold hover:bg-gold-dark text-carbon font-semibold py-3 rounded-md transition-colors text-sm tracking-wide">
            Ingresar al sistema
          </button>
        </form>
      </div>
    </div>
  );
}

```

---

### 4. Panel General (Dashboard)

**Ruta del archivo:** `frontend/app/page.tsx`

**¿Qué hace?** Reemplaza la lista básica por un panel de control con métricas rápidas (KPIs) y alertas (ej. artículos bajo el mínimo). Enfocado 100% en el Sprint 1 (Stock).

```tsx
"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui";
import { Package, AlertCircle, ArrowRightLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-full">
      <PageHeader eyebrow="PANEL GENERAL" titulo="Resumen de Inventario" descripcion="Vista rápida del estado del stock y alertas operativas del Hotel Alejandro I." />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-6 mb-8 mt-2">
        <div className="bg-white p-5 rounded-lg border border-line shadow-sm flex items-center gap-4">
          <div className="p-3 bg-carbon/5 text-carbon rounded-md"><Package size={24} /></div>
          <div><div className="text-xs font-sans text-carbon/60 tracking-wider mb-1">TOTAL ARTÍCULOS</div><div className="text-2xl font-serif text-carbon font-semibold">128</div></div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-line shadow-sm flex items-center gap-4">
          <div className="p-3 bg-danger/10 text-danger rounded-md"><AlertCircle size={24} /></div>
          <div><div className="text-xs font-sans text-carbon/60 tracking-wider mb-1">BAJO MÍNIMO</div><div className="text-2xl font-serif text-danger font-semibold">4</div></div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-line shadow-sm flex items-center gap-4">
          <div className="p-3 bg-gold/10 text-gold-dark rounded-md"><ArrowRightLeft size={24} /></div>
          <div><div className="text-xs font-sans text-carbon/60 tracking-wider mb-1">MOVIMIENTOS HOY</div><div className="text-2xl font-serif text-carbon font-semibold">12</div></div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-line shadow-sm flex items-center gap-4">
          <div className="p-3 bg-success/10 text-success rounded-md"><CheckCircle2 size={24} /></div>
          <div><div className="text-xs font-sans text-carbon/60 tracking-wider mb-1">DEPÓSITOS ACTIVOS</div><div className="text-2xl font-serif text-carbon font-semibold">4</div></div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 px-6 pb-8">
        <Card titulo="Atención Requerida" descripcion="Artículos por debajo del stock mínimo.">
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex items-center justify-between p-3 bg-danger/5 border border-danger/20 rounded-md">
              <div className="flex flex-col"><span className="text-sm font-semibold text-carbon">Servilleta blanca x500</span><span className="text-xs text-carbon/60">Depósito Cocina</span></div>
              <div className="text-right"><span className="text-sm font-bold text-danger">0 pack</span><div className="text-xs text-carbon/50">Mín: 20</div></div>
            </div>
            <div className="flex items-center justify-between p-3 bg-warning/5 border border-warning/20 rounded-md">
              <div className="flex flex-col"><span className="text-sm font-semibold text-carbon">Papel higiénico x4</span><span className="text-xs text-carbon/60">Depósito Central</span></div>
              <div className="text-right"><span className="text-sm font-bold text-warning">96 pack</span><div className="text-xs text-carbon/50">Mín: 120</div></div>
            </div>
          </div>
          <div className="mt-4 text-right">
            <Link href="/stock/existencias" className="text-sm text-gold hover:text-gold-dark font-medium transition-colors">Ver reporte de existencias &rarr;</Link>
          </div>
        </Card>

        <Card titulo="Operaciones Frecuentes" descripcion="Accesos directos del Módulo de Stock.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <Link href="/stock/movimientos" className="p-4 border border-line rounded-lg hover:border-gold hover:bg-gold/5 transition-all group">
              <div className="text-gold mb-2 group-hover:scale-110 transition-transform duration-200"><ArrowRightLeft size={20} /></div>
              <div className="font-semibold text-carbon text-sm mb-1">Registrar Movimiento</div>
              <div className="text-xs text-carbon/60">Ingresos o egresos de mercadería.</div>
            </Link>
            <Link href="/stock/transferencias" className="p-4 border border-line rounded-lg hover:border-gold hover:bg-gold/5 transition-all group">
              <div className="text-gold mb-2 group-hover:scale-110 transition-transform duration-200"><Package size={20} /></div>
              <div className="font-semibold text-carbon text-sm mb-1">Nueva Transferencia</div>
              <div className="text-xs text-carbon/60">Mover stock entre depósitos.</div>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

```

---

### 💡 Nota Final: Layout de Pantallas

Cuando les toque maquetar una pantalla del Sprint (ej. `STK-02 Artículos`), utilicen la estructura de CSS Grid (2 columnas) para que quede idéntica al diseño aprobado: una columna principal (`1.5fr`) para la tabla y una secundaria (`1fr`) a la derecha para el formulario fijado con `sticky`.

*¡Éxitos con el Sprint!* 🚀