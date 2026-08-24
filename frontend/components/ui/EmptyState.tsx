import type { ReactNode } from "react";

/**
 * Pantalla vacía. Nunca dejar una tabla sin filas y sin explicación:
 * decile al usuario qué falta y cuál es la acción para arrancar.
 */
export function EmptyState({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <span
        aria-hidden
        className="mb-2 h-9 w-9 rotate-45 rounded-md border-2 border-gold/50"
      />
      <h3 className="font-serif text-lg text-carbon">{titulo}</h3>
      <p className="max-w-sm text-sm text-carbon/60">{descripcion}</p>
      {accion && <div className="mt-3">{accion}</div>}
    </div>
  );
}
