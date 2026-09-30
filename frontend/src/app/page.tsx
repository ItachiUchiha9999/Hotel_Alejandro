"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Card, InfoBox, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { api } from "@/lib/api";
import type { FilaSaldo, Movimiento } from "@/lib/types";

type PeriodoFinanciero = "SEMANA" | "MES";
interface PuntoFinanciero { fecha: string; ingresos: number; egresos: number; neto: number; }
interface MovimientoFinanciero { fecha: string; tipo: "INGRESO" | "EGRESO"; detalle: string; importe: number; }
interface ReporteFinanciero { periodo: PeriodoFinanciero; desde: string; hasta: string; serie: PuntoFinanciero[]; totales: { ingresos: number; egresos: number; neto: number }; comparacion: { desde: string; hasta: string; totales: { ingresos: number; egresos: number; neto: number } }; movimientos: MovimientoFinanciero[]; }

const fechaLocalHoy = () => {
  const hoy = new Date();
  hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
  return hoy.toISOString().slice(0, 10);
};
const moneda = (valor: number) => valor.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const monedaCompacta = (valor: number) => new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(valor);
const variacionTexto = (actual: number, anterior: number) => anterior === 0 ? (actual === 0 ? "Sin cambios respecto al período anterior" : "Nuevo en este período") : `${actual - anterior >= 0 ? "+" : ""}${(((actual - anterior) / anterior) * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}% vs. período anterior`;
const fechaCorta = (valor: string) => new Date(`${valor}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

function GraficoFinanciero({ puntos }: { puntos: PuntoFinanciero[] }) {
  const ancho = 900; const alto = 280; const margenX = 46; const margenY = 24;
  const valores = puntos.flatMap((p) => [p.ingresos, p.egresos, p.neto]);
  const maximo = Math.max(...valores, 1); const minimo = Math.min(...valores, 0);
  const rango = maximo - minimo || 1;
  const x = (i: number) => margenX + (puntos.length <= 1 ? 0 : (i / (puntos.length - 1)) * (ancho - margenX * 2));
  const y = (n: number) => margenY + ((maximo - n) / rango) * (alto - margenY * 2 - 22);
  const path = (clave: "ingresos" | "egresos" | "neto") => puntos.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p[clave])}`).join(" ");
  const etiquetas = puntos.length > 10 ? new Set([0, ...Array.from({ length: Math.ceil(puntos.length / 5) }, (_, i) => Math.min((i + 1) * 5 - 1, puntos.length - 1)), puntos.length - 1]) : null;
  const ticks = [maximo, (maximo + minimo) / 2, minimo];
  return <div className="overflow-x-auto">
    <svg viewBox={`0 0 ${ancho} ${alto}`} className="min-w-162.5 w-full" role="img" aria-label="Gráfico diario de ingresos, egresos y balance neto">
      {ticks.map((tick, index) => <g key={`${tick}-${index}`}><line x1={margenX} x2={ancho - margenX} y1={y(tick)} y2={y(tick)} stroke="#e8e0d4" strokeDasharray="4 5" /><text x={margenX - 7} y={y(tick) + 4} textAnchor="end" fontSize="10" fill="#756f67">${monedaCompacta(tick)}</text></g>)}
      {minimo < 0 && maximo > 0 && <line x1={margenX} x2={ancho - margenX} y1={y(0)} y2={y(0)} stroke="#8c8172" strokeWidth="1.5" />}
      <path d={path("ingresos")} fill="none" stroke="#3d8065" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <path d={path("egresos")} fill="none" stroke="#bd6b57" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <path d={path("neto")} fill="none" stroke="#c99f52" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {puntos.map((p, i) => <g key={p.fecha}><circle cx={x(i)} cy={y(p.ingresos)} r="3" fill="#3d8065"><title>{p.fecha}: ingresos {moneda(p.ingresos)}</title></circle><circle cx={x(i)} cy={y(p.egresos)} r="3" fill="#bd6b57"><title>{p.fecha}: egresos {moneda(p.egresos)}</title></circle><circle cx={x(i)} cy={y(p.neto)} r="3" fill="#c99f52"><title>{p.fecha}: neto {moneda(p.neto)}</title></circle>{(!etiquetas || etiquetas.has(i)) && <text x={x(i)} y={alto - 4} textAnchor="middle" fontSize="10" fill="#756f67">{fechaCorta(p.fecha)}</text>}</g>)}
    </svg>
  </div>;
}

/**
 * Inicio del sistema.
 *
 * Antes esta página era una copia casi literal de /articulos (35 KB duplicados,
 * con su propio estado, sus propios fetch y un switch de vista que nunca se
 * usaba). Ahora es un panel de entrada: muestra lo que hay que mirar primero y
 * lleva a cada módulo.
 */

export default function InicioPage() {
  const [saldo, setSaldo] = useState<FilaSaldo[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [sinBackend, setSinBackend] = useState(false);
  const [cargandoOperativo, setCargandoOperativo] = useState(true);
  const [periodo, setPeriodo] = useState<PeriodoFinanciero>("MES");
  const [fechaFinanzas, setFechaFinanzas] = useState(fechaLocalHoy);
  const [reporte, setReporte] = useState<ReporteFinanciero | null>(null);
  const [cargandoReporte, setCargandoReporte] = useState(true);
  const [errorReporte, setErrorReporte] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, m] = await Promise.all([
          api.get<FilaSaldo[]>("/stock"),
          api.get<Movimiento[]>("/stock/movimientos"),
        ]);
        setSaldo(s);
        setMovimientos(m.slice(0, 5));
      } catch {
        setSinBackend(true);
      } finally {
        setCargandoOperativo(false);
      }
    })();
  }, []);

  useEffect(() => {
    let vigente = true;
    setCargandoReporte(true); setErrorReporte(false); setReporte(null);
    api.get<ReporteFinanciero>(`/dashboard/finanzas?periodo=${periodo}&fecha=${fechaFinanzas}`)
      .then((data) => { if (vigente) setReporte(data); })
      .catch(() => { if (vigente) setErrorReporte(true); })
      .finally(() => { if (vigente) setCargandoReporte(false); });
    return () => { vigente = false; };
  }, [periodo, fechaFinanzas]);

  const bajoMinimo = saldo.filter(
    (f) => Number(f.stock_amount) < Number(f.articles.article_stock_min_general),
  );

  return (
    <>
      <PageHeader
        eyebrow="SIGH · Sistema de Gestión Hotelera"
        titulo="Hotel Alejandro I"
        descripcion="Resumen financiero y operativo de reservas, habitaciones e insumos."
      />

      <Card className="mb-6" titulo="Alertas de stock" descripcion={cargandoOperativo ? "Consultando niveles de inventario…" : sinBackend ? "No se pudo verificar el inventario." : bajoMinimo.length > 0 ? `${bajoMinimo.length} artículo(s) necesitan reposición.` : "No hay artículos por debajo del mínimo configurado."}>
        {cargandoOperativo ? <p className="py-3 text-sm text-carbon/55">Consultando stock…</p> : sinBackend ? <p className="py-3 text-sm text-red-700">No se pudo verificar el inventario. Revisá la conexión con el servidor.</p> : bajoMinimo.length === 0 ? <p className="py-3 text-sm text-carbon/55">Todo en orden.</p> : <Table><THead><TH>Artículo</TH><TH>Depósito</TH><TH className="text-right">Actual / mínimo</TH></THead><TBody>{bajoMinimo.slice(0, 5).map((f) => <TR key={f.stock_id}><TD className="font-medium">{f.articles.article_name}</TD><TD className="text-xs">{f.deposit.deposit_name}</TD><TD className="text-right tabular-nums"><Badge tono="alerta">{Number(f.stock_amount)} / {Number(f.articles.article_stock_min_general)}</Badge></TD></TR>)}</TBody></Table>}
      </Card>

      <Card className="mb-6" titulo="Resumen financiero" descripcion="Ingresos cobrados, pagos realizados y balance neto por fecha.">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-line bg-bone/40 p-1" aria-label="Período del reporte">
            {(["SEMANA", "MES"] as const).map((opcion) => <button key={opcion} type="button" onClick={() => setPeriodo(opcion)} aria-pressed={periodo === opcion} className={`rounded-md px-4 py-2 text-sm transition-colors ${periodo === opcion ? "bg-carbon text-white" : "text-carbon/65 hover:bg-white"}`}>{opcion === "SEMANA" ? "Semana" : "Mes"}</button>)}
          </div>
          <label className="flex items-center gap-2 text-sm text-carbon/65">{periodo === "SEMANA" ? "Fecha de la semana" : "Fecha del mes"}<input type="date" value={fechaFinanzas} onChange={(e) => setFechaFinanzas(e.target.value)} className="rounded-md border border-line bg-white px-3 py-2 text-sm text-carbon focus:border-gold focus:outline-none" /></label>
        </div>

        {errorReporte ? <InfoBox tipo="error">No se pudo cargar el resumen financiero. Revisá que el backend y la base de datos estén disponibles.</InfoBox> : <>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-success/20 bg-success/5 p-4"><p className="text-xs uppercase tracking-wide text-carbon/55">Ingresos registrados</p><p className="mt-1 text-xl font-semibold tabular-nums text-success">{cargandoReporte ? "…" : moneda(reporte?.totales.ingresos ?? 0)}</p>{reporte && <p className="mt-1 text-xs text-carbon/55">{variacionTexto(reporte.totales.ingresos, reporte.comparacion.totales.ingresos)}</p>}</div>
            <div className="rounded-lg border border-red-200 bg-red-50/60 p-4"><p className="text-xs uppercase tracking-wide text-carbon/55">Egresos pagados</p><p className="mt-1 text-xl font-semibold tabular-nums text-red-700">{cargandoReporte ? "…" : moneda(reporte?.totales.egresos ?? 0)}</p>{reporte && <p className="mt-1 text-xs text-carbon/55">{variacionTexto(reporte.totales.egresos, reporte.comparacion.totales.egresos)}</p>}</div>
            <div className="rounded-lg border border-gold/25 bg-gold/5 p-4"><p className="text-xs uppercase tracking-wide text-carbon/55">Balance neto</p><p className={`mt-1 text-xl font-semibold tabular-nums ${(reporte?.totales.neto ?? 0) < 0 ? "text-red-700" : "text-carbon"}`}>{cargandoReporte ? "…" : moneda(reporte?.totales.neto ?? 0)}</p>{reporte && <p className="mt-1 text-xs text-carbon/55">Comparado con {fechaCorta(reporte.comparacion.desde)} — {fechaCorta(reporte.comparacion.hasta)}</p>}</div>
          </div>
          {cargandoReporte && !reporte ? <p className="py-12 text-center text-sm text-carbon/50">Cargando movimientos financieros…</p> : reporte && <>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-carbon/50"><span>{fechaCorta(reporte.desde)} — {fechaCorta(reporte.hasta)}</span><div className="flex flex-wrap gap-x-4 gap-y-1"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-success" />Ingresos</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#bd6b57]" />Egresos</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-gold" />Neto</span></div></div>
            <GraficoFinanciero puntos={reporte.serie} />
          </>}
          {reporte && reporte.movimientos.length > 0 && <details className="mt-4 rounded-lg border border-line"><summary className="cursor-pointer px-4 py-3 text-sm font-medium text-carbon hover:bg-bone/30">Ver detalle de {reporte.movimientos.length} movimiento{reporte.movimientos.length === 1 ? "" : "s"}</summary><div className="border-t border-line"><Table><THead><TH>Fecha</TH><TH>Tipo</TH><TH>Detalle</TH><TH className="text-right">Importe</TH><TH /></THead><TBody>{reporte.movimientos.map((m, i) => <TR key={`${m.fecha}-${m.tipo}-${i}`}><TD className="whitespace-nowrap text-xs">{fechaCorta(m.fecha)}</TD><TD><Badge tono={m.tipo === "INGRESO" ? "activo" : "alerta"}>{m.tipo === "INGRESO" ? "Ingreso" : "Egreso"}</Badge></TD><TD>{m.detalle}</TD><TD className="text-right font-medium tabular-nums">{moneda(m.importe)}</TD><TD><Link className="text-xs text-carbon underline underline-offset-2" href={m.tipo === "INGRESO" ? "/reservas" : "/proveedores/ordenes-pago"}>{m.tipo === "INGRESO" ? "Reservas" : "Órdenes"}</Link></TD></TR>)}</TBody></Table></div></details>}
          <p className="mt-3 rounded-md bg-bone/45 px-3 py-2 text-xs leading-5 text-carbon/55">Ingresos: pagos de alojamiento registrados y cargos de habitación cobrados. Egresos: órdenes de pago a proveedores confirmadas. La comparación usa la semana o el mes inmediatamente anterior.</p>
        </>}
      </Card>

      {sinBackend && (
        <div className="mb-6">
          <InfoBox tipo="error" titulo="Sin conexión con el servidor:">
            no se pudieron cargar los datos. Verificá que el backend esté corriendo en el
            puerto configurado en NEXT_PUBLIC_API_URL.
          </InfoBox>
        </div>
      )}

      <div className="grid gap-6">
        <Card titulo="Últimos movimientos" descripcion="Las cinco operaciones más recientes.">
          {movimientos.length === 0 ? (
            <p className="py-6 text-center text-sm text-carbon/45">Todavía no hay movimientos.</p>
          ) : (
            <ul className="divide-y divide-line">
              {movimientos.map((m) => (
                <li key={m.stock_movement_id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-carbon">
                      {m.movement_type.movement_type.replaceAll("_", " ")}
                    </p>
                    <p className="text-xs text-carbon/50">
                      {m.deposit_origin?.deposit_name ?? "Proveedor"} →{" "}
                      {m.deposit_destination?.deposit_name ?? "Consumo"}
                    </p>
                  </div>
                  <span className="text-xs text-carbon/45">
                    {new Date(m.transaction_date).toLocaleDateString("es-AR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
