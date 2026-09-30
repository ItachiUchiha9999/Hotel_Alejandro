"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULOS, type ItemNavegacion } from "@/lib/navegacion";
import { cn } from "@/lib/cn";

interface SidebarProps {
  abierto: boolean;
  onCerrar: () => void;
}

/** Ícono de menú. Antes venía de lucide-react, que no está instalado. */
function IconoMenu({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

/** Un módulo está activo si estamos en su ruta o en alguna de sus hijas. */
function estaActivo(pathname: string, item: ItemNavegacion): boolean {
  if (item.ruta === "/") return pathname === "/";
  return pathname === item.ruta || pathname.startsWith(`${item.ruta}/`);
}

export function Sidebar({ abierto, onCerrar }: SidebarProps) {
  const pathname = usePathname();
  const [colapsado, setColapsado] = useState(false);
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});

  return (
    <>
      {abierto && (
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar menú"
          className="fixed inset-0 z-30 bg-carbon/60 lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-carbon py-6",
          "transition-all duration-300 ease-in-out motion-reduce:transition-none",
          colapsado ? "w-20 px-2" : "w-64 px-4",
          abierto ? "translate-x-0" : "-translate-x-full",
          "lg:sticky lg:top-16 lg:z-0 lg:h-[calc(100vh-4rem)] lg:translate-x-0",
        )}
      >
        <div className={cn("flex items-center pb-4", colapsado ? "justify-center" : "justify-between px-3")}>
          {!colapsado && (
            <h2 className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-bone/40">
              Módulos
            </h2>
          )}

          <button
            type="button"
            onClick={() => setColapsado(!colapsado)}
            title={colapsado ? "Expandir menú" : "Colapsar menú"}
            className="hidden items-center justify-center rounded-md p-1.5 text-bone/50 transition-colors hover:bg-white/10 hover:text-bone lg:flex"
          >
            <IconoMenu className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {MODULOS.map((modulo) => {
            const activo = estaActivo(pathname, modulo);
            const tieneHijos = Boolean(modulo.hijos?.length);
            const desplegado = expandidos[modulo.ruta] ?? activo;

            const clasesBase = cn(
              "flex min-h-[40px] w-full items-center rounded-lg py-2.5 text-sm transition-colors",
              colapsado ? "justify-center px-0" : "px-3 text-left",
              "focus-visible:outline-2 focus-visible:outline-gold",
              activo
                ? "bg-white/10 font-medium text-bone"
                : "text-bone/55 hover:bg-white/5 hover:text-bone",
            );

            return (
              <div key={modulo.ruta}>
                {tieneHijos ? (
                  <button
                    type="button"
                    onClick={() => setExpandidos({ ...expandidos, [modulo.ruta]: !desplegado })}
                    aria-expanded={desplegado}
                    title={colapsado ? modulo.nombre : undefined}
                    className={clasesBase}
                  >
                    {colapsado ? (
                      <span aria-hidden>{modulo.nombre.charAt(0)}</span>
                    ) : (
                      <>
                        <span className="flex-1">{modulo.nombre}</span>
                        <span aria-hidden className="text-xs text-bone/40">
                          {desplegado ? "−" : "+"}
                        </span>
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    href={modulo.ruta}
                    onClick={onCerrar}
                    aria-current={activo ? "page" : undefined}
                    title={colapsado ? modulo.nombre : undefined}
                    className={clasesBase}
                  >
                    {colapsado ? (
                      <span aria-hidden>{modulo.nombre.charAt(0)}</span>
                    ) : (
                      <span>{modulo.nombre}</span>
                    )}
                  </Link>
                )}

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
                            "focus-visible:outline-2 focus-visible:outline-gold",
                            hijoActivo ? "text-gold" : "text-bone/45 hover:text-bone/80",
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
