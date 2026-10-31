"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PageContainer } from "./PageContainer";
import { api, ApiError } from "@/lib/api";
import { inicioPorRol, rutaPermitida, type RolSistema } from "@/lib/permisos";
import { ToastProvider } from "@/components/ui/Toast";

type UsuarioSesion = { employees_id: number; rol: RolSistema; nombre: string; email: string };

// Breadcrumb mapping for routes
const routeBreadcrumbs: Record<string, Array<{ label: string; href?: string; current?: boolean }>> = {
  "/": [{ label: "Dashboard", current: true }],
  "/reservas": [{ label: "Reservas", href: "/reservas", current: true }],
  "/reservas/checkin": [
    { label: "Reservas", href: "/reservas" },
    { label: "Check-in / Check-out", current: true }
  ],
  "/reservas/calendario": [
    { label: "Reservas", href: "/reservas" },
    { label: "Calendario", current: true }
  ],
  "/habitaciones": [{ label: "Habitaciones", href: "/habitaciones", current: true }],
  "/habitaciones/tipos": [
    { label: "Habitaciones", href: "/habitaciones" },
    { label: "Tipos de habitación", current: true }
  ],
  "/habitaciones/tarifas": [
    { label: "Habitaciones", href: "/habitaciones" },
    { label: "Tarifas", current: true }
  ],
  "/habitaciones/housekeeping": [
    { label: "Habitaciones", href: "/habitaciones" },
    { label: "Housekeeping", current: true }
  ],
  "/huespedes": [{ label: "Huéspedes", href: "/huespedes", current: true }],
  "/inventario": [{ label: "Inventario", href: "/inventario", current: true }],
  "/inventario/articulos": [
    { label: "Inventario", href: "/inventario" },
    { label: "Artículos", current: true }
  ],
  "/inventario/depositos": [
    { label: "Inventario", href: "/inventario" },
    { label: "Depósitos", current: true }
  ],
  "/inventario/movimientos": [
    { label: "Inventario", href: "/inventario" },
    { label: "Movimientos", current: true }
  ],
  "/inventario/categorias": [
    { label: "Inventario", href: "/inventario" },
    { label: "Categorías", current: true }
  ],
  "/proveedores": [{ label: "Proveedores", href: "/proveedores", current: true }],
  "/proveedores/ordenes-compra": [
    { label: "Proveedores", href: "/proveedores" },
    { label: "Órdenes de compra", current: true }
  ],
  "/proveedores/comprobantes": [
    { label: "Proveedores", href: "/proveedores" },
    { label: "Comprobantes", current: true }
  ],
  "/proveedores/ordenes-pago": [
    { label: "Proveedores", href: "/proveedores" },
    { label: "Órdenes de pago", current: true }
  ],
  "/proveedores/cuenta-corriente": [
    { label: "Proveedores", href: "/proveedores" },
    { label: "Cuenta corriente", current: true }
  ],
  "/reportes": [{ label: "Reportes", href: "/reportes", current: true }],
  "/configuracion": [{ label: "Configuración", href: "/configuracion", current: true }],
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [sesionVerificada, setSesionVerificada] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const esPublica = pathname === "/web" || pathname.startsWith("/web/");
    if (pathname === "/login" || esPublica) {
      setSesionVerificada(true);
      return;
    }

    let vigente = true;
    setSesionVerificada(false);
    api.get<UsuarioSesion>("/auth/me").then((actual) => {
      if (!vigente) return;
      setUsuario(actual);
      window.localStorage.setItem("sesionIniciada", "true");
      window.localStorage.setItem("rolUsuario", actual.rol);
      window.localStorage.setItem("employeeId", String(actual.employees_id));
      if (!rutaPermitida(actual.rol, pathname)) router.replace(inicioPorRol(actual.rol));
      else setSesionVerificada(true);
    }).catch((error: unknown) => {
      if (!vigente) return;
      if (error instanceof ApiError && error.status === 401) {
        window.localStorage.removeItem("sesionIniciada");
        window.localStorage.removeItem("tokenSesion");
        window.localStorage.removeItem("rolUsuario");
        window.localStorage.removeItem("employeeId");
        window.localStorage.removeItem("usuarioNombre");
      }
      router.replace("/login");
    });
    return () => { vigente = false; };
  }, [pathname, router]);

  if (pathname === "/login" || pathname === "/web" || pathname.startsWith("/web/")) {
    return (
      <ToastProvider>
        {children}
      </ToastProvider>
    );
  }
  if (!sesionVerificada || !usuario) {
    return (
      <ToastProvider>
        <main className="grid min-h-screen place-items-center bg-neutral-50 text-sm text-neutral-500">
          Verificando permisos de acceso…
        </main>
      </ToastProvider>
    );
  }

  // Get breadcrumbs for current route
  const breadcrumbs = routeBreadcrumbs[pathname] || [{ label: "Hotel Alejandro I", current: true }];

  return (
    <ToastProvider>
      <PageContainer breadcrumbs={breadcrumbs}>
        {children}
      </PageContainer>
    </ToastProvider>
  );
}