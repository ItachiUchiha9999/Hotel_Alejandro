"use client";

import { useRouter } from "next/navigation";
import { Isotipo } from "./Isotipo";

interface HeaderProps {
  onAbrirMenu: () => void;
  usuario?: { iniciales: string; nombre: string };
}

export function Header({ onAbrirMenu, usuario }: HeaderProps) {
  const iniciales = usuario?.iniciales ?? "US";
  const router = useRouter();

  // Función para borrar la sesión y volver al Login
  const handleCerrarSesion = () => {
    localStorage.removeItem("sesionIniciada");
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between gap-4 border-b border-white/10 bg-carbon-dark px-4 md:px-6">
      {/* Izquierda: menú mobile + marca */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onAbrirMenu}
          aria-label="Abrir menú de módulos"
          className="rounded-md p-2 text-bone/70 transition-colors hover:bg-white/10 hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        {/* 👇 AQUÍ REEMPLAZAMOS EL LINK POR UN DIV ESTÁTICO */}
        <div className="flex min-w-0 items-center gap-3 select-none">
          <Isotipo className="h-9 w-9 shrink-0 text-gold" />
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-serif text-xl tracking-wide text-bone">
              Hotel Alejandro I
            </span>
            <span className="hidden text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-gold sm:inline">
              SIGH
            </span>
          </span>
        </div>
      </div>

      {/* Derecha: usuario con botón de cerrar sesión */}
      <div className="flex items-center gap-3 md:gap-5">
        <button
          type="button"
          onClick={handleCerrarSesion}
          title="Cerrar sesión"
          aria-label={`Cuenta de ${usuario?.nombre ?? "usuario"}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-semibold text-carbon transition-colors hover:bg-gold-dark hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {iniciales}
        </button>
      </div>
    </header>
  );
}