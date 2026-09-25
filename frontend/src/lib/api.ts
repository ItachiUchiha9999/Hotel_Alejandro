/**
 * Cliente HTTP único del frontend.
 */

import type { Reserva, ReservaDetalle, TipoHabitacion } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Payload = Record<string, unknown> | undefined;

async function request<T>(ruta: string, init?: RequestInit): Promise<T> {
  let respuesta: Response;

  try {
    respuesta = await fetch(`${API_URL}/api${ruta}`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      ...init,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    throw new ApiError(
      "No se pudo conectar con el servidor. Verificá que el backend esté corriendo.",
      0,
    );
  }

  const cuerpo = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new ApiError(
      cuerpo?.message ?? `El servidor respondió con estado ${respuesta.status}.`,
      respuesta.status,
    );
  }

  return (cuerpo?.data ?? cuerpo) as T;
}

export const api = {
  get: <T>(ruta: string, init?: RequestInit) => request<T>(ruta, init),
  post: <T>(ruta: string, body?: Payload) =>
    request<T>(ruta, { method: "POST", body: JSON.stringify(body ?? {}) }),
  put: <T>(ruta: string, body?: Payload) =>
    request<T>(ruta, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  patch: <T>(ruta: string, body?: Payload) =>
    request<T>(ruta, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
};

export const urlDescarga = (ruta: string) => `${API_URL}/api${ruta}`;

/* ---------------------------------------------------------------------------
 * Reservas (RES-01, RES-09, RES-11)
 * ------------------------------------------------------------------------- */

export interface FiltrosReservas {
  estado?: string;
  desde?: string;
  hasta?: string;
}

export function getReservas(filtros: FiltrosReservas = {}, init?: RequestInit) {
  const params = new URLSearchParams();
  if (filtros.estado) params.set("estado", filtros.estado);
  if (filtros.desde) params.set("desde", filtros.desde);
  if (filtros.hasta) params.set("hasta", filtros.hasta);
  const query = params.toString();
  return api.get<Reserva[]>(`/reservas${query ? `?${query}` : ""}`, init);
}

export function getReserva(id: number | string) {
  return api.get<ReservaDetalle>(`/reservas/${id}`);
}

export interface DatosCheckIn {
  actualAdults?: number;
  actualChildren?: number;
  observations?: string;
  employeeId: number | string;
}

export function checkInReserva(id: number | string, datos: DatosCheckIn) {
  const { employeeId, ...resto } = datos;
  return api.post<Reserva>(`/reservas/${id}/checkin`, {
    ...resto,
    usuarioRecepcionId: employeeId,
  });
}

export interface DatosCheckOut {
  pendingCharges?: boolean;
  pendingDetail?: string;
  observations?: string;
  employeeId: number | string;
}

export function checkOutReserva(id: number | string, datos: DatosCheckOut) {
  const { employeeId, ...resto } = datos;
  return api.post<Reserva>(`/reservas/${id}/checkout`, {
    ...resto,
    usuarioRecepcionId: employeeId,
  });
}

/* ---------------------------------------------------------------------------
 * Mantenimiento y Housekeeping (HAB-06)
 * ------------------------------------------------------------------------- */

export type DatosBloqueoMantenimiento = {
  roomId: number;
  tipo: "MANTENIMIENTO" | "LIMPIEZA" | "FUERA_DE_SERVICIO";
  fechaInicio: string;
  fechaFinEstimada: string;
  motivo: string;
  employeeId?: number | string;
};

/**
 * El formulario de habitaciones usa nombres en español; el módulo de
 * housekeeping recibe los de la tabla. La traducción vive acá para no tocar
 * los componentes que ya estaban escritos.
 */
function aHousekeeping(datos: DatosBloqueoMantenimiento): Record<string, unknown> {
  return {
    room_id: datos.roomId,
    maintenance_type: datos.tipo,
    start_date: datos.fechaInicio,
    estimated_end_date: datos.fechaFinEstimada,
    reason: datos.motivo,
    employees_id: datos.employeeId,
  };
}

export function registrarMantenimiento(datos: DatosBloqueoMantenimiento) {
  return api.post<{ ok: boolean; message: string; data: any }>("/housekeeping", aHousekeeping(datos));
}

export function cerrarMantenimiento(
  id: number,
  datos: { fechaFinReal?: string; notasCierre?: string; employeeId?: number | string }
) {
  return api.patch<{ ok: boolean; message: string; data: any }>(`/housekeeping/${id}/finalizar`, {
    actual_end_date: datos.fechaFinReal,
    closing_notes: datos.notasCierre,
    employees_id: datos.employeeId,
  });
}

export function getMantenimientosActivos(roomId?: number) {
  const query = roomId ? `?habitacion=${roomId}&abiertos=true` : "?abiertos=true";
  return api.get<any[]>(`/housekeeping${query}`);
}

/* ---------------------------------------------------------------------------
 * Tipos de habitación y Tarifas (HAB-04, TAR-01)
 * ------------------------------------------------------------------------- */

export function getTiposHabitacion(filtroEstado?: string) {
  const q = filtroEstado && filtroEstado !== "TODOS" ? `?estado=${filtroEstado}` : "";
  return api.get<TipoHabitacion[]>(`/tipos-habitacion${q}`);
}

export function asignarTarifaTipo(
  id: number,
  datos: { basePrice: number; reason?: string; employeeId?: string | number }
) {
  return api.post<{ ok: boolean; message: string; data: TipoHabitacion }>(
    `/tipos-habitacion/${id}/tarifa`,
    datos as Record<string, unknown>
  );
}

export function getHistorialTarifas(id: number) {
  return api.get<any[]>(`/tipos-habitacion/${id}/tarifas/historial`);
}