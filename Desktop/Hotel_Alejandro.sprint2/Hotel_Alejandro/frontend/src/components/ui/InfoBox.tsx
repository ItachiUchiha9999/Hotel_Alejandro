import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Tipo = "regla" | "error" | "exito";

const estilos: Record<Tipo, string> = {
  regla: "border-info/25 bg-info/8 text-carbon/80",
  error: "border-danger/30 bg-danger/8 text-danger",
  exito: "border-success/30 bg-success/8 text-success",
};

/**
 * Caja de mensaje dentro de un formulario.
 * "regla" -> explica una regla automática del sistema.
 * "error" -> respuesta fallida del backend.
 * "exito" -> confirmación de la operación.
 */
export function InfoBox({
  tipo = "regla",
  titulo,
  children,
}: {
  tipo?: Tipo;
  titulo?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tipo === "error" ? "alert" : undefined}
      className={cn(
        "flex gap-3 rounded-lg border px-4 py-3 text-sm",
        estilos[tipo],
      )}
    >
      <span
        aria-hidden
        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current"
      />
      <p>
        {titulo && <strong className="font-semibold">{titulo} </strong>}
        {children}
      </p>
    </div>
  );
}