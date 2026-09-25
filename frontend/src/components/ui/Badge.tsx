import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Tono = "activo" | "inactivo" | "info" | "alerta" | "peligro";

const tonos: Record<Tono, string> = {
  activo: "bg-success/10 text-success ring-success/25",
  inactivo: "bg-carbon/8 text-carbon/60 ring-carbon/15",
  info: "bg-info/10 text-info ring-info/25",
  alerta: "bg-warning/10 text-warning ring-warning/25",
  // Mismo tono "danger" que ya usa Button para su variante "peligro":
  // hacía falta un 5to color para distinguir CANCELADA de NO_SHOW en reservas.
  peligro: "bg-danger/10 text-danger ring-danger/25",
};

/** Etiqueta de estado. Estado del depósito, del movimiento, del artículo, etc. */
export function Badge({ tono = "info", children }: { tono?: Tono; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        tonos[tono],
      )}
    >
      {children}
    </span>
  );
}