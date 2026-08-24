/**
 * Tipos compartidos entre módulos.
 * Cada desarrollador agrega los tipos de SU funcionalidad en su propio
 * archivo (ej. lib/types/articulos.ts) para no chocar en Git.
 */

export type Rol = "ADMINISTRADOR" | "ENCARGADO_STOCK" | "GERENTE";

export interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  rol: Rol;
}

/** Respuesta paginada estándar del backend. */
export interface Paginado<T> {
  items: T[];
  total: number;
  pagina: number;
  porPagina: number;
}

/* ---- STK-01: Depósitos (ejemplo de referencia) ---- */
export interface Deposito {
  id: number;
  nombre: string;
  activo: boolean;
  createdAt?: string;
  updatedAt?: string;
}
