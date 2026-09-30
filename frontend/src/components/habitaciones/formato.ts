import type { EstadoHabitacion } from "@/lib/types";

export const ETIQUETA_ESTADO: Record<string, string> = {
  DISPONIBLE: "Disponible",
  OCUPADA: "Ocupada",
  LIMPIEZA: "Limpieza",
  MANTENIMIENTO: "Mantenimiento",
  FUERA_DE_SERVICIO: "Fuera de servicio",
};

export const TONO_ESTADO: Record<string, "activo" | "inactivo" | "info" | "alerta"> = {
  DISPONIBLE: "activo",
  OCUPADA: "info",
  LIMPIEZA: "alerta",
  MANTENIMIENTO: "alerta",
  FUERA_DE_SERVICIO: "inactivo",
};
