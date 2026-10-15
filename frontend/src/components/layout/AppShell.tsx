"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { api, ApiError } from "@/lib/api";
import { inicioPorRol, rutaPermitida, type RolSistema } from "@/lib/permisos";

type UsuarioSesion = { employees_id: number; rol: RolSistema; nombre: string; email: string };

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
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
    return <>{children}</>;
  }
  if (!sesionVerificada || !usuario) {
    return <main className="grid min-h-screen place-items-center bg-bone text-sm text-carbon/60">Verificando permisos de acceso…</main>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-bone">
      <Header
        onAbrirMenu={() => setMenuAbierto(true)}
        usuario={{ iniciales: usuario.nombre.split(/\s+/).map((parte) => parte[0]).slice(0, 2).join("").toUpperCase(), nombre: usuario.nombre, rol: usuario.rol }}
      />

      <div className="flex flex-1">
        <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} rol={usuario.rol} />

        <main className="min-w-0 flex-1 px-4 py-8 md:px-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
