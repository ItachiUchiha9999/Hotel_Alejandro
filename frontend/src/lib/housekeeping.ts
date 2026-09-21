/**
 * Tipos de HU-9 (HAB-06) — Mantenimiento y limpieza.
 *
 * Van en un archivo propio y no dentro de lib/types.ts para que esta historia
 * pueda integrarse sin tocar un archivo que editan todos los integrantes.
 * Cuando el módulo de habitaciones (HAB-01) defina su propio tipo `Habitacion`,
 * conviene reemplazar `HabitacionTablero` por uno que lo extienda.
 */

export type EstadoHabitacion =
  | "DISPONIBLE"
  | "OCUPADA"
  | "LIMPIEZA"
  | "MANTENIMIENTO"
  | "FUERA_DE_SERVICIO";

export type TipoBloqueo = "LIMPIEZA" | "MANTENIMIENTO" | "FUERA_DE_SERVICIO";

export interface BloqueoResumen {
  maintenance_id: number;
  maintenance_type: TipoBloqueo;
  start_date: string;
  estimated_end_date: string;
  reason: string;
}

/** Fila de GET /api/housekeeping/tablero */
export interface HabitacionTablero {
  room_id: number;
  room_number: string;
  floor_number: number | null;
  room_status: EstadoHabitacion;
  room_type_name: string;
  max_capacity: number;
  bloqueo_vigente: BloqueoResumen | null;
  bloqueos_programados: BloqueoResumen[];
  /** Salió del check-out y todavía no se limpió: la tarea más urgente del turno. */
  pendiente_post_checkout: boolean;
}

/** Respuesta de GET /api/housekeeping/resumen */
export type ResumenEstados = Record<EstadoHabitacion | "TOTAL", number>;

export interface EmpleadoRef {
  employees_name: string;
  employees_lastname: string;
}

/** Fila de GET /api/housekeeping */
export interface Bloqueo {
  maintenance_id: number;
  room_id: number;
  maintenance_type: TipoBloqueo;
  start_date: string;
  estimated_end_date: string;
  actual_end_date: string | null;
  reason: string;
  closing_notes: string | null;
  room: {
    room_id: number;
    room_number: string;
    floor_number: number | null;
    room_status: EstadoHabitacion;
    room_type: { room_type_name: string };
  };
  opened_by_employee: EmpleadoRef;
  closed_by_employee: EmpleadoRef | null;
}

/** Etiqueta legible y tono del Badge para cada estado. */
export const ESTADO_UI: Record<
  EstadoHabitacion,
  { etiqueta: string; tono: "activo" | "inactivo" | "info" | "alerta" }
> = {
  DISPONIBLE: { etiqueta: "Disponible", tono: "activo" },
  OCUPADA: { etiqueta: "Ocupada", tono: "info" },
  LIMPIEZA: { etiqueta: "Limpieza", tono: "alerta" },
  MANTENIMIENTO: { etiqueta: "Mantenimiento", tono: "alerta" },
  FUERA_DE_SERVICIO: { etiqueta: "Fuera de servicio", tono: "inactivo" },
};

export const TIPO_BLOQUEO_UI: Record<TipoBloqueo, { etiqueta: string; ayuda: string }> = {
  LIMPIEZA: {
    etiqueta: "Limpieza",
    ayuda: "Hasta un día. No impide reservas: la habitación se entrega limpia al huésped que llega.",
  },
  MANTENIMIENTO: {
    etiqueta: "Mantenimiento",
    ayuda: "Reparación o arreglo. Saca la habitación de venta en esas fechas.",
  },
  FUERA_DE_SERVICIO: {
    etiqueta: "Fuera de servicio",
    ayuda: "Baja prolongada: obra, remodelación o clausura.",
  },
};
