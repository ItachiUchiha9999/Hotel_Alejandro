export type AgrupacionIngresos = "MES" | "SEMANA";
export type OrigenIngreso = "RESERVAS" | "SERVICIOS" | "CONSUMOS";
export interface PeriodoIngresos {
  inicio: string; desde: string; hasta: string; origenes: Record<OrigenIngreso, number>; total: number; acumulado: number;
}
export interface MovimientoIngreso { id: string; fecha: string; origen: OrigenIngreso; detalle: string; reserva: string; importe: number; }
export interface ReporteIngresos {
  desde: string; hasta: string; agrupacion: AgrupacionIngresos; total: number; moneda: string; cantidad_cobros: number;
  comparacion: { desde: string; hasta: string; dias: number; total: number; diferencia: number; variacion_porcentual: number | null };
  origenes: { id: OrigenIngreso; nombre: string; importe: number }[];
  serie: PeriodoIngresos[]; movimientos: MovimientoIngreso[];
}
export const ORIGENES_INGRESOS: { id: OrigenIngreso; nombre: string; color: string }[] = [
  { id: "RESERVAS", nombre: "Reservas / alojamiento", color: "#3f7a5e" },
  { id: "SERVICIOS", nombre: "Servicios", color: "#3d6b87" },
  { id: "CONSUMOS", nombre: "Consumos", color: "#b3453c" },
];
export const monedaIngreso = (valor: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(valor);
export const fechaIngreso = (valor: string) => valor.split("-").reverse().join("/");
