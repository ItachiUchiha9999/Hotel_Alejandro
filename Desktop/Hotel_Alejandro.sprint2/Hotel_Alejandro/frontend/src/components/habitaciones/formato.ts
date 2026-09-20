import type { EstadoHabitacion } from "@/lib/types";

export const ETIQUETA_ESTADO: Record<EstadoHabitacion, string> = {
  DISPONIBLE: "Disponible",
  OCUPADA: "Ocupada",
  MANTENIMIENTO: "En mantenimiento",
};

export const TONO_ESTADO: Record<EstadoHabitacion, "activo" | "info" | "alerta"> = {
  DISPONIBLE: "activo",
  OCUPADA: "info",
  MANTENIMIENTO: "alerta",
};