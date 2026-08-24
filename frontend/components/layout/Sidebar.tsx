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
  
  // Memoria para recordar qué menús desplegables están abiertos
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});

  return (
    <>
      {/* Fondo oscuro en mobile */}
      {abierto && (
        <div
          onClick={onCerrar}
          className="fixed inset-0 z-30 bg-carbon/60 lg:hidden"
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 shrink-0 overflow-y-auto border-r border-white/10 bg-carbon py-6 flex flex-col",
          "transition-all duration-300 ease-in-out motion-reduce:transition-none",
          colapsado ? "w-20 px-2" : "w-64 px-4",
          abierto ? "translate-x-0" : "-translate-x-full",
          "lg:sticky lg:top-16 lg:z-0 lg:h-[calc(100vh-4rem)] lg:translate-x-0"
        )}
      >
        <div className={cn("flex items-center pb-4", colapsado ? "justify-center" : "justify-between px-3")}>
          {!colapsado && (
            <h2 className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-bone/40 transition-opacity">
              Módulos
            </h2>
          )}
          
          <button
            onClick={() => setColapsado(!colapsado)}
            className="hidden lg:flex items-center justify-center p-1.5 rounded-md text-bone/50 hover:bg-white/10 hover:text-bone transition-colors"
            title={colapsado ? "Expandir menú" : "Colapsar menú"}
          >
            <Menu size={20} />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {MODULOS.map((modulo) => {
            const activo = pathname.startsWith(modulo.ruta);
            const tieneHijos = modulo.hijos && modulo.hijos.length > 0;
            
            // Si el usuario no lo tocó, está desplegado si estamos en una de sus rutas
            const desplegado = expandidos[modulo.ruta] !== undefined ? expandidos[modulo.ruta] : activo;

            // Clases base compartidas para que el botón y el enlace se vean idénticos
            const clasesBase = cn(
              "w-full flex items-center rounded-lg py-2.5 text-sm transition-colors min-h-[40px]",
              colapsado ? "justify-center px-0" : "px-3 text-left",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold",
              activo
                ? "bg-white/10 font-medium text-bone"
                : "text-bone/55 hover:bg-white/5 hover:text-bone"
            );

            return (
              <div key={modulo.ruta}>
                {tieneHijos ? (
                  // Si tiene hijos, usamos un botón que solo despliega las opciones
                  <button
                    onClick={() => setExpandidos({ ...expandidos, [modulo.ruta]: !desplegado })}
                    title={colapsado ? modulo.nombre : undefined}
                    className={clasesBase}
                  >
                    {!colapsado && <span>{modulo.nombre}</span>}
                  </button>
                ) : (
                  // Si NO tiene hijos, usamos un Link que nos lleva a la página
                  <Link
                    href={modulo.ruta}
                    onClick={onCerrar}
                    aria-current={activo ? "page" : undefined}
                    title={colapsado ? modulo.nombre : undefined}
                    className={clasesBase}
                  >
                    {!colapsado && <span>{modulo.nombre}</span>}
                  </Link>
                )}

                {/* Submenú de opciones */}
                {!colapsado && desplegado && tieneHijos && (
                  <div className="ml-3 mt-1 flex flex-col gap-0.5 border-l border-white/10 pl-3">
                    {modulo.hijos!.map((hijo) => {
                      const hijoActivo = pathname === hijo.ruta;
                      return (
                        <Link
                          key={hijo.ruta}
                          href={hijo.ruta}
                          onClick={onCerrar}
                          aria-current={hijoActivo ? "page" : undefined}
                          className={cn(
                            "rounded-md px-3 py-1.5 text-[0.8rem] transition-colors",
                            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold",
                            hijoActivo
                              ? "text-gold"
                              : "text-bone/45 hover:text-bone/80"
                          )}
                        >
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