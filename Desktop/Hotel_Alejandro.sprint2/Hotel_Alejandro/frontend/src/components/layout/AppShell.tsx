"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  
  const pathname = usePathname();
  const router = useRouter();

  // EL GUARDIA DE SEGURIDAD
  useEffect(() => {
    // Buscamos si existe el pase VIP en el navegador
    const tieneSesion = localStorage.getItem("sesionIniciada");

    // Si NO tiene sesión y está intentando entrar a cualquier lado que NO sea el login...
    if (!tieneSesion && pathname !== "/login") {
      // Lo pateamos de vuelta al login
      router.push("/login");
    }
  }, [pathname, router]);

  // Si la ruta es el Login, dibujamos la pantalla limpia sin menús
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Para el resto del sistema, dibujamos la estructura normal:
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