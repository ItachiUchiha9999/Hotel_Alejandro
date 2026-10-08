"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, BedDouble, Calendar, ArrowRight, DollarSign, Percent } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Button, Card, InfoBox, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { api, urlDescarga, getReporteOcupacionTemporadas, type ReporteOcupacionTemporadas } from "@/lib/api";
import type { FilaSaldo, Movimiento } from "@/lib/types";

type PeriodoFinanciero = "SEMANA" | "MES";
interface PuntoFinanciero { fecha: string; ingresos: number; egresos: number; neto: number; margen_porcentual: number | null; }
interface MovimientoFinanciero { fecha: string; tipo: "INGRESO" | "EGRESO"; detalle: string; importe: number; }
interface ReporteFinanciero { periodo: PeriodoFinanciero; desde: string; hasta: string; serie: PuntoFinanciero[]; totales: { ingresos: number; egresos: number; neto: number; margen_porcentual: number | null }; comparacion: { desde: string; hasta: string; totales: { ingresos: number; egresos: number; neto: number; margen_porcentual: number | null } }; movimientos: MovimientoFinanciero[]; }

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
    <svg viewBox={`0 0 ${ancho} ${alto}`} className="min-w-162.5 w-full" role="img" aria-label="Gráfico diario de ingresos, egresos y resultado neto">
      {ticks.map((tick, index) => <g key={`${tick}-${index}`}><line x1={margenX} x2={ancho - margenX} y1={y(tick)} y2={y(tick)} stroke="#e8e0d4" strokeDasharray="4 5" /><text x={margenX - 7} y={y(tick) + 4} textAnchor="end" fontSize="10" fill="#756f67">${monedaCompacta(tick)}</text></g>)}
      {minimo < 0 && maximo > 0 && <line x1={margenX} x2={ancho - margenX} y1={y(0)} y2={y(0)} stroke="#8c8172" strokeWidth="1.5" />}
      <path d={path("ingresos")} fill="none" stroke="#3d8065" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <path d={path("egresos")} fill="none" stroke="#bd6b57" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <path d={path("neto")} fill="none" stroke="#c99f52" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {puntos.map((p, i) => <g key={p.fecha}><circle cx={x(i)} cy={y(p.ingresos)} r="3" fill="#3d8065"><title>{p.fecha}: ingresos {moneda(p.ingresos)}</title></circle><circle cx={x(i)} cy={y(p.egresos)} r="3" fill="#bd6b57"><title>{p.fecha}: egresos {moneda(p.egresos)}</title></circle><circle cx={x(i)} cy={y(p.neto)} r={p.neto < 0 ? "5" : "3"} fill={p.neto < 0 ? "#b3453c" : "#c99f52"}><title>{p.fecha}: resultado {moneda(p.neto)}{p.neto < 0 ? " (negativo)" : ""}</title></circle>{(!etiquetas || etiquetas.has(i)) && <text x={x(i)} y={alto - 4} textAnchor="middle" fontSize="10" fill="#756f67">{fechaCorta(p.fecha)}</text>}</g>)}
    </svg>
  </div>;
}

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
  const [exportando, setExportando] = useState<"pdf" | "xlsx" | null>(null);
  const [errorExportacion, setErrorExportacion] = useState<string | null>(null);

  // REP-08: Estado del panel de ocupación y tarifas estacionales
  const [reporteOcupacion, setReporteOcupacion] = useState<ReporteOcupacionTemporadas | null>(null);
  const [cargandoOcupacion, setCargandoOcupacion] = useState(true);

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

  // Cargar datos de ocupación y tarifas por temporada del mes actual
  useEffect(() => {
    const hoy = fechaLocalHoy();
    const inicioMes = `${hoy.slice(0, 7)}-01`;
    getReporteOcupacionTemporadas({ desde: inicioMes, hasta: hoy })
      .then((data) => setReporteOcupacion(data))
      .catch(() => {})
      .finally(() => setCargandoOcupacion(false));
  }, []);

  const bajoMinimo = saldo.filter(
    (f) => Number(f.stock_amount) < Number(f.articles.article_stock_min_general),
  );

  async function exportarFinanzas(formato: "pdf" | "xlsx") {
    setExportando(formato);
    setErrorExportacion(null);
    try {
      const parametros = new URLSearchParams({ periodo, fecha: fechaFinanzas, formato });
      const respuesta = await fetch(urlDescarga(`/dashboard/finanzas/exportar?${parametros}`));
      if (!respuesta.ok) {
        const datos = await respuesta.json();
        throw new Error(datos.message ?? "No se pudo exportar el reporte.");
      }
      const enlace = document.createElement("a");
      const url = URL.createObjectURL(await respuesta.blob());
      enlace.href = url;
      enlace.download = `rentabilidad-${periodo.toLowerCase()}-${fechaFinanzas}.${formato}`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setErrorExportacion(err instanceof Error ? err.message : "No se pudo descargar el reporte.");
    } finally {
      setExportando(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="SIGH · Sistema de Gestión Hotelera"
        titulo="Hotel Alejandro I"
        descripcion="Resumen financiero, operativo y rendimiento de reservas por temporada."
      />

      <Card className="mb-6" titulo="Alertas de stock" descripcion={cargandoOperativo ? "Consultando niveles de inventario…" : sinBackend ? "No se pudo verificar el inventario." : bajoMinimo.length > 0 ? `${bajoMinimo.length} artículo(s) necesitan reposición.` : "No hay artículos por debajo del mínimo configurado."}>
        {cargandoOperativo ? <p className="py-3 text-sm text-carbon/55">Consultando stock…</p> : sinBackend ? <p className="py-3 text-sm text-red-700">No se pudo verificar el inventario. Revisá la conexión con el servidor.</p> : bajoMinimo.length === 0 ? <p className="py-3 text-sm text-carbon/55">Todo en orden.</p> : <Table><THead><TH>Artículo</TH><TH>Depósito</TH><TH className="text-right">Actual / mínimo</TH></THead><TBody>{bajoMinimo.slice(0, 5).map((f) => <TR key={f.stock_id}><TD className="font-medium">{f.articles.article_name}</TD><TD className="text-xs">{f.deposit.deposit_name}</TD><TD className="text-right tabular-nums"><Badge tono="alerta">{Number(f.stock_amount)} / {Number(f.articles.article_stock_min_general)}</Badge></TD></TR>)}</TBody></Table>}
      </Card>

      {/* Widget REP-08: Ocupación y Rendimiento por Temporada */}
      <Card
        className="mb-6"
        titulo="Ocupación y Rendimiento por Temporada"
        descripcion="Desempeño acumulado en el mes corriente según tarifas estacionales."
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-line bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-carbon/55">Tasa de Ocupación</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-carbon">
                    {cargandoOcupacion ? "…" : `${reporteOcupacion?.resumen.tasa_ocupacion_global_pct ?? 0}%`}
                  </p>
                  <p className="mt-1 text-xs text-carbon/50">
                    {reporteOcupacion?.resumen.noches_ocupadas ?? 0} de {reporteOcupacion?.resumen.capacidad_total_noches ?? 0} noches
                  </p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/15 text-carbon">
                  <Percent size={18} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-carbon/55">Ingresos Alojamiento</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-carbon">
                    {cargandoOcupacion ? "…" : moneda(reporteOcupacion?.resumen.ingresos_totales_alojamiento ?? 0)}
                  </p>
                  <p className="mt-1 text-xs text-carbon/50">Facturación bruta estacional</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/15 text-carbon">
                  <DollarSign size={18} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-carbon/55">ADR (Tarifa Promedio)</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-carbon">
                    {cargandoOcupacion ? "…" : moneda(reporteOcupacion?.resumen.adr_global ?? 0)}
                  </p>
                  <p className="mt-1 text-xs text-carbon/50">Por noche vendida</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/15 text-carbon">
                  <BedDouble size={18} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-carbon/55">RevPAR</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-carbon">
                    {cargandoOcupacion ? "…" : moneda(reporteOcupacion?.resumen.revpar ?? 0)}
                  </p>
                  <p className="mt-1 text-xs text-carbon/50">Por noche disponible</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/15 text-carbon">
                  <Calendar size={18} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-line bg-bone/30 px-4 py-2.5">
            <span className="text-xs text-carbon/65">
              Cálculo cruzado entre reservas efectivas y tarifas configuradas por temporada.
            </span>
            <Link
              href="/reportes/temporadas"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-carbon hover:text-gold transition-colors"
            >
              Ver reporte analítico completo
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </Card>

      <Card className="mb-6" titulo="Resumen financiero" descripcion="Ingresos cobrados, egresos pagados y resultado neto por fecha.">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-line bg-bone/40 p-1" aria-label="Período del reporte">
            {(["SEMANA", "MES"] as const).map((opcion) => <button key={opcion} type="button" onClick={() => setPeriodo(opcion)} aria-pressed={periodo === opcion} className={`rounded-md px-4 py-2 text-sm transition-colors ${periodo === opcion ? "bg-carbon text-white" : "text-carbon/65 hover:bg-white"}`}>{opcion === "SEMANA" ? "Semana" : "Mes"}</button>)}
          </div>
          <label className="flex items-center gap-2 text-sm text-carbon/65">{periodo === "SEMANA" ? "Fecha de la semana" : "Fecha del mes"}<input type="date" value={fechaFinanzas} onChange={(e) => setFechaFinanzas(e.target.value)} className="rounded-md border border-line bg-white px-3 py-2 text-sm text-carbon focus:border-gold focus:outline-none" /></label>
          <div className="flex gap-2">
            <Button variante="secundario" disabled={!reporte || cargandoReporte || exportando !== null} cargando={exportando === "pdf"} onClick={() => exportarFinanzas("pdf")}><Download size={15} />PDF</Button>
            <Button variante="secundario" disabled={!reporte || cargandoReporte || exportando !== null} cargando={exportando === "xlsx"} onClick={() => exportarFinanzas("xlsx")}><Download size={15} />Excel</Button>
          </div>
        </div>

        {errorExportacion && <div className="mb-4"><InfoBox tipo="error">{errorExportacion}</InfoBox></div>}
        {errorReporte ? <InfoBox tipo="error">No se pudo cargar el resumen financiero. Revisá que el backend y la base de datos estén disponibles.</InfoBox> : <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-success/20 bg-success/5 p-4"><p className="text-xs uppercase tracking-wide text-carbon/55">Ingresos registrados</p><p className="mt-1 text-xl font-semibold tabular-nums text-success">{cargandoReporte ? "…" : moneda(reporte?.totales.ingresos ?? 0)}</p>{reporte && <p className="mt-1 text-xs text-carbon/55">{variacionTexto(reporte.totales.ingresos, reporte.comparacion.totales.ingresos)}</p>}</div>
            <div className="rounded-lg border border-red-200 bg-red-50/60 p-4"><p className="text-xs uppercase tracking-wide text-carbon/55">Egresos pagados</p><p className="mt-1 text-xl font-semibold tabular-nums text-red-700">{cargandoReporte ? "…" : moneda(reporte?.totales.egresos ?? 0)}</p>{reporte && <p className="mt-1 text-xs text-carbon/55">{variacionTexto(reporte.totales.egresos, reporte.comparacion.totales.egresos)}</p>}</div>
            <div className={`rounded-lg border p-4 ${(reporte?.totales.neto ?? 0) < 0 ? "border-red-300 bg-red-50" : "border-gold/25 bg-gold/5"}`}><p className="text-xs uppercase tracking-wide text-carbon/55">Resultado del período</p><p className={`mt-1 text-xl font-semibold tabular-nums ${(reporte?.totales.neto ?? 0) < 0 ? "text-red-700" : "text-carbon"}`}>{cargandoReporte ? "…" : moneda(reporte?.totales.neto ?? 0)}</p>{reporte && <p className="mt-1 text-xs text-carbon/55">Comparado con {fechaCorta(reporte.comparacion.desde)} — {fechaCorta(reporte.comparacion.hasta)}</p>}</div>
            <div className="rounded-lg border border-line bg-white p-4"><p className="text-xs uppercase tracking-wide text-carbon/55">Margen porcentual</p><p className={`mt-1 text-xl font-semibold tabular-nums ${(reporte?.totales.margen_porcentual ?? 0) < 0 ? "text-red-700" : "text-carbon"}`}>{cargandoReporte ? "…" : reporte?.totales.margen_porcentual === null ? "Sin ingresos" : `${reporte?.totales.margen_porcentual.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`}</p><p className="mt-1 text-xs text-carbon/55">Resultado ÷ ingresos</p></div>
          </div>
          {cargandoReporte && !reporte ? <p className="py-12 text-center text-sm text-carbon/50">Cargando movimientos financieros…</p> : reporte && <>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-carbon/50"><span>{fechaCorta(reporte.desde)} — {fechaCorta(reporte.hasta)}</span><div className="flex flex-wrap gap-x-4 gap-y-1"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-success" />Ingresos</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#bd6b57]" />Egresos</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-gold" />Resultado</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-danger" />Resultado negativo</span></div></div>
            <GraficoFinanciero puntos={reporte.serie} />
            <section className="mt-5 border-t border-line pt-5" aria-labelledby="resultado-diario-titulo">
              <h3 id="resultado-diario-titulo" className="mb-3 font-serif text-lg text-carbon">Resultado por día</h3>
              <Table><THead><TH>Fecha</TH><TH className="text-right">Ingresos</TH><TH className="text-right">Egresos</TH><TH className="text-right">Resultado</TH><TH className="text-right">Margen</TH></THead><TBody>
                {reporte.serie.map(punto => <TR key={punto.fecha} className={punto.neto < 0 ? "bg-red-50" : undefined}>
                  <TD>{fechaCorta(punto.fecha)}</TD>
                  <TD className="text-right tabular-nums">{moneda(punto.ingresos)}</TD>
                  <TD className="text-right tabular-nums">{moneda(punto.egresos)}</TD>
                  <TD className={`text-right font-medium tabular-nums ${punto.neto < 0 ? "text-red-700" : ""}`}>{punto.neto < 0 && <Badge tono="alerta">Negativo</Badge>} {moneda(punto.neto)}</TD>
                  <TD className={`text-right tabular-nums ${punto.neto < 0 ? "text-red-700" : ""}`}>{punto.margen_porcentual === null ? "—" : `${punto.margen_porcentual.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`}</TD>
                </TR>)}
              </TBody></Table>
            </section>
          </>}
          {reporte && reporte.movimientos.length > 0 && <details className="mt-4 rounded-lg border border-line"><summary className="cursor-pointer px-4 py-3 text-sm font-medium text-carbon hover:bg-bone/30">Ver detalle de {reporte.movimientos.length} movimiento{reporte.movimientos.length === 1 ? "" : "s"}</summary><div className="border-t border-line"><Table><THead><TH>Fecha</TH><TH>Tipo</TH><TH>Detalle</TH><TH className="text-right">Importe</TH><TH /></THead><TBody>{reporte.movimientos.map((m, i) => <TR key={`${m.fecha}-${m.tipo}-${i}`}><TD className="whitespace-nowrap text-xs">{fechaCorta(m.fecha)}</TD><TD><Badge tono={m.tipo === "INGRESO" ? "activo" : "alerta"}>{m.tipo === "INGRESO" ? "Ingreso" : "Egreso"}</Badge></TD><TD>{m.detalle}</TD><TD className="text-right font-medium tabular-nums">{moneda(m.importe)}</TD><TD><Link className="text-xs text-carbon underline underline-offset-2" href={m.tipo === "INGRESO" ? "/reservas" : "/proveedores/ordenes-pago"}>{m.tipo === "INGRESO" ? "Reservas" : "Órdenes"}</Link></TD></TR>)}</TBody></Table></div></details>}
          <p className="mt-3 rounded-md bg-bone/45 px-3 py-2 text-xs leading-5 text-carbon/55">Ingresos: alojamiento y cargos de habitación cobrados. Egresos: órdenes de pago confirmadas desde la fuente compartida con REP-07. Margen: resultado del período dividido por sus ingresos; si no hubo ingresos, no se calcula.</p>
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