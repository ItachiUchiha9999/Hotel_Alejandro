import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

interface CardProps {
  titulo?: string;
  descripcion?: string;
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Contenedor blanco estándar. Todo formulario o tabla del sistema
 * vive adentro de una Card: es lo que da la coherencia entre módulos.
 */
export function Card({
  titulo,
  descripcion,
  acciones,
  children,
  className,
}: CardProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-line bg-white shadow-card",
        className,
      )}
    >
      {(titulo || acciones) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-4">
          <div>
            {titulo && (
              <h2 className="font-serif text-lg text-carbon">{titulo}</h2>
            )}
            {descripcion && (
              <p className="mt-0.5 text-sm text-carbon/60">{descripcion}</p>
            )}
          </div>
          {acciones && <div className="flex items-center gap-2">{acciones}</div>}
        </header>
      )}
      <div className="px-6 py-6">{children}</div>
    </section>
  );
}

/** Pie de la card, para la fila de botones Cancelar / Guardar. */
export function CardFooter({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-6 -mb-6 mt-6 flex justify-end gap-3 border-t border-line bg-bone/40 px-6 py-4">
      {children}
    </div>
  );
}