export type RolSistema = "ADMINISTRADOR" | "GERENTE" | "ENCARGADO_STOCK" | "GOBERNANZA" | "RECEPCION";

const rutasPorRol: Record<Exclude<RolSistema, "ADMINISTRADOR" | "GERENTE">, string[]> = {
  ENCARGADO_STOCK: ["/articulos", "/categorias", "/stock", "/proveedores", "/stock/saldo", "/stock/historial"],
  GOBERNANZA: ["/habitaciones/panel", "/habitaciones/housekeeping"],
  RECEPCION: ["/reservas", "/habitaciones/panel", "/habitaciones/disponibilidad"],
};

export function rolValido(valor: string | null): valor is RolSistema {
  return valor === "ADMINISTRADOR" || valor === "GERENTE" || valor === "ENCARGADO_STOCK" || valor === "GOBERNANZA" || valor === "RECEPCION";
}

export function rutaPermitida(rol: RolSistema, ruta: string): boolean {
  if (rol === "ADMINISTRADOR" || rol === "GERENTE") return true;
  return rutasPorRol[rol].some((permitida) => ruta === permitida || ruta.startsWith(`${permitida}/`));
}

export function inicioPorRol(rol: RolSistema): string {
  if (rol === "GERENTE") return "/";
  if (rol === "ENCARGADO_STOCK") return "/articulos";
  if (rol === "GOBERNANZA") return "/habitaciones/housekeeping";
  if (rol === "RECEPCION") return "/reservas";
  return "/";
}

export function puedeVerRuta(rol: RolSistema, ruta: string): boolean {
  if (rol === "ADMINISTRADOR" || rol === "GERENTE") return true;
  if (rol === "ENCARGADO_STOCK") return ["/articulos", "/categorias", "/stock", "/proveedores", "/stock/saldo", "/stock/historial"].some((base) => ruta === base || ruta.startsWith(`${base}/`));
  if (rol === "GOBERNANZA") return ["/habitaciones/panel", "/habitaciones/housekeeping"].includes(ruta);
  return ["/reservas", "/habitaciones/panel", "/habitaciones/disponibilidad"].includes(ruta);
}
