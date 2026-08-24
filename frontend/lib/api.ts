/**
 * Cliente HTTP único del sistema. TODOS los módulos consumen el backend
 * desde acá: así el manejo de errores, el token JWT y la URL base
 * se configuran en un solo lugar.
 *
 * Requiere en frontend/.env.local:
 *   NEXT_PUBLIC_API_URL=http://localhost:3000/api
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

/** Error de negocio devuelto por el backend (400, 401, 404, 409, 500...). */
export class ApiError extends Error {
  status: number;
  detalles?: unknown;

  constructor(message: string, status: number, detalles?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detalles = detalles;
  }
}

function obtenerToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("sigh_token");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = obtenerToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });

  if (res.status === 204) return undefined as T;

  const cuerpo = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      cuerpo?.message ?? cuerpo?.error ?? "No se pudo completar la operación.",
      res.status,
      cuerpo?.errors,
    );
  }

  // Aceptamos { data: ... } o el objeto plano.
  return (cuerpo?.data ?? cuerpo) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
