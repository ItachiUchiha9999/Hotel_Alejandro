/**
 * Cliente HTTP único del frontend.
 *
 * Antes cada pantalla escribía su propio fetch con la URL del backend
 * hardcodeada, y no coincidían entre sí: unas apuntaban al puerto 3000 y otras
 * al 4000. Acá la base sale de una sola variable de entorno.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Error de la API con el código HTTP y el mensaje que mandó el backend. */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Payload = Record<string, unknown> | undefined;

/**
 * El backend responde siempre { ok, data, message }.
 * Este helper devuelve directamente `data` para que las pantallas no tengan
 * que desenvolver la respuesta en cada llamada.
 */
async function request<T>(ruta: string, init?: RequestInit): Promise<T> {
  let respuesta: Response;

  try {
    respuesta = await fetch(`${API_URL}/api${ruta}`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      ...init,
    });
  } catch (err) {
    // Si la request fue cancelada a propósito (AbortController, usado para
    // descartar respuestas de filtros que ya quedaron obsoletos), no es un
    // error de conexión: hay que dejar pasar el AbortError tal cual para que
    // quien llamó pueda distinguirlo y lo ignore en silencio.
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

/** Para descargas directas (Excel), que no pasan por fetch. */
export const urlDescarga = (ruta: string) => `${API_URL}/api${ruta}`;