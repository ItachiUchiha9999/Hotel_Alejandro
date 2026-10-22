"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, BedDouble, Calendar, ArrowRight, DollarSign, Percent } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Button, Card, InfoBox, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { api, authHeaders, urlDescarga, getReporteOcupacionTemporadas, type ReporteOcupacionTemporadas } from "@/lib/api";
import type { FilaSaldo, Movimiento } from "@/lib/types";

type PeriodoFinanciero = "SEMANA" | "MES" | "ANIO";
interface PuntoFinanciero { pendiente?: boolean; fecha: string; ingresos: number; egresos: number; neto: number; margen_porcentual: number | null; }
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

function GraficoFinanciero({ puntos, anual = false }: { puntos: PuntoFinanciero[]; anual?: boolean }) {
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string | null>(null);
  const hayMovimientos = puntos.some(p => p.ingresos !== 0 || p.egresos !== 0);
  if (!hayMovimientos && !anual) return <p className="rounded-lg bg-bone/45 px-5 py-10 text-center text-sm text-[#514d46]">No hay cobros ni pagos registrados en este período.</p>;

  const ancho = Math.max(900, puntos.length * 64 + 104);
  const alto = 380;
  const izquierda = 76;
  const derecha = 20;
  const arriba = 24;
  const abajo = 48;
  const valores = puntos.flatMap(p => [p.ingresos, p.egresos, p.neto]);
  const mayorValor = Math.max(...valores, 0);
  const menorValor = Math.min(...valores, 0);
  // Escala compartida: las barras parten de cero y la línea puede bajar de él.
  const amplitud = Math.max(mayorValor, Math.abs(menorValor), 1);
  const potencia = 10 ** Math.floor(Math.log10(amplitud / 3));
  const paso = Math.ceil(amplitud / 3 / potencia) * potencia;
  const maximo = Math.max(paso, Math.ceil(mayorValor / paso) * paso);
  const minimo = Math.floor(menorValor / paso) * paso;
  const ticks = Array.from({ length: Math.round((maximo - minimo) / paso) + 1 }, (_, i) => minimo + i * paso);
  const espacio = (ancho - izquierda - derecha) / puntos.length;
  const anchoBarra = Math.min(espacio * 0.40, 42);
  const x = (i: number) => izquierda + espacio * (i + 0.5);
  const y = (valor: number) => arriba + (maximo - valor) / (maximo - minimo) * (alto - arriba - abajo);
  const cero = y(0);
  const linea = puntos.map((p, i) => p.pendiente ? "" : `${i === 0 || puntos[i - 1].pendiente ? "M" : "L"} ${x(i)} ${y(p.neto)}`).join(" ");
  const indiceInicial = puntos.reduce((ultimo, p, i) => p.ingresos !== 0 || p.egresos !== 0 ? i : ultimo, 0);
  const indiceBuscado = puntos.findIndex(p => p.fecha === fechaSeleccionada);
  const indiceSeleccionado = indiceBuscado >= 0 ? indiceBuscado : indiceInicial;
  const seleccionado = puntos[indiceSeleccionado];
  const fechaCompleta = new Date(`${seleccionado.fecha}T12:00:00`).toLocaleDateString("es-AR", anual ? { month: "long", year: "numeric" } : { day: "numeric", month: "long" });
  const estado = seleccionado.pendiente ? "Mes pendiente" : seleccionado.neto < 0 ? "Resultado negativo" : seleccionado.neto > 0 ? "Resultado positivo" : "Sin diferencia";

  return <div>
    <p className="mb-3 text-xs leading-5 text-[#514d46]">Compará ingresos y egresos de cada {anual ? "mes" : "día"}. La línea amarilla muestra el resultado. Deslizá para recorrer el período y seleccioná {anual ? "un mes" : "un día"} para ver el detalle.</p>
    <div className="overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold" role="region" aria-label={anual ? "Comparativa financiera anual por mes" : "Comparativa financiera diaria; desplazate horizontalmente para ver todos los días"} tabIndex={0}>
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full" style={{ minWidth: ancho }} role="group" aria-label={`Barras de ingresos y egresos y línea del resultado neto por ${anual ? "mes" : "día"}`}>
        {ticks.map(tick => <g key={tick}>
          <line x1={izquierda} x2={ancho - derecha} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? "#8c8172" : "#e8e0d4"} strokeWidth={tick === 0 ? 1.5 : 1} opacity={tick === 0 ? 1 : 0.55} />
          <text x={izquierda - 12} y={y(tick) + 4} textAnchor="end" fontSize="12" fill="#514d46">{tick < 0 ? "−" : ""}${monedaCompacta(Math.abs(tick))}</text>
        </g>)}
        <rect x={izquierda + espacio * indiceSeleccionado} y={arriba} width={espacio} height={alto - arriba - abajo} fill="#f2f3f1" opacity="0.8" pointerEvents="none" />
        {puntos.map((p, i) => <g key={`barras-${p.fecha}`}>
          {p.pendiente && <rect x={izquierda + espacio * i} y={arriba} width={espacio} height={alto - arriba - abajo} fill="#faf9f6" />}
          {p.ingresos !== 0 && <rect x={x(i) - anchoBarra - 2} y={Math.min(cero, y(p.ingresos))} width={anchoBarra} height={Math.abs(cero - y(p.ingresos))} rx="1" fill="#008580" />}
          {p.egresos !== 0 && <rect x={x(i) + 2} y={Math.min(cero, y(p.egresos))} width={anchoBarra} height={Math.abs(cero - y(p.egresos))} rx="1" fill="#d63f3f" />}
          <text x={x(i)} y={alto - 16} textAnchor="middle" fontSize="13" fill="#514d46">{anual ? new Date(`${p.fecha}T12:00:00`).toLocaleDateString("es-AR", { month: "short" }).replace(".", "").toUpperCase() : p.fecha.slice(-2)}</text>
          {p.pendiente && <text x={x(i)} y={alto - 2} textAnchor="middle" fontSize="10" fill="#756f67">Pendiente</text>}
        </g>)}
        <path d={linea} fill="none" stroke="#e8b943" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />
        {puntos.map((p, i) => <g key={p.fecha}>
          {i === indiceSeleccionado && !p.pendiente && <circle cx={x(i)} cy={y(p.neto)} r={i === indiceSeleccionado ? 4.5 : 3} fill={p.neto < 0 ? "#b3453c" : "#b1851a"} stroke="white" strokeWidth="1.5" pointerEvents="none" />}
          <rect x={izquierda + espacio * i} y={arriba} width={espacio} height={alto - arriba - abajo} fill="transparent" role="button" tabIndex={0}
            aria-label={p.pendiente ? `${p.fecha.slice(0, 7)}: mes pendiente` : `${fechaCorta(p.fecha)}: ingresos ${moneda(p.ingresos)}, egresos ${moneda(p.egresos)}, resultado ${moneda(p.neto)}. Ver detalle.`}
            aria-pressed={i === indiceSeleccionado}
            className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gold"
            onMouseEnter={() => setFechaSeleccionada(p.fecha)} onFocus={() => setFechaSeleccionada(p.fecha)} onClick={() => setFechaSeleccionada(p.fecha)}
            onKeyDown={evento => {
              if (evento.key === "Enter" || evento.key === " ") { evento.preventDefault(); setFechaSeleccionada(p.fecha); }
            }}>
            <title>{`${fechaCorta(p.fecha)} · Ingresos: ${moneda(p.ingresos)} · Egresos: ${moneda(p.egresos)} · Resultado: ${moneda(p.neto)}`}</title>
          </rect>
        </g>)}
      </svg>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg bg-bone/45 px-4 py-3 text-sm sm:grid-cols-4" aria-label={anual ? "Detalle del mes seleccionado" : "Detalle del día seleccionado"}>
      <div><p className="text-xs text-[#514d46]">{anual ? "Mes seleccionado" : "Día seleccionado"}</p><p className="mt-1 font-medium text-carbon">{fechaCompleta}</p></div>
      <div><p className="text-xs text-[#514d46]">Ingresos cobrados</p><p className="mt-1 font-semibold tabular-nums text-[#2d654f]">{seleccionado.pendiente ? "—" : moneda(seleccionado.ingresos)}</p></div>
      <div><p className="text-xs text-[#514d46]">Egresos pagados</p><p className="mt-1 font-semibold tabular-nums text-[#934c3b]">{seleccionado.pendiente ? "—" : moneda(seleccionado.egresos)}</p></div>
      <div><p className="text-xs text-[#514d46]">{estado}</p><p className={`mt-1 font-semibold tabular-nums ${seleccionado.neto < 0 ? "text-red-700" : seleccionado.neto > 0 ? "text-[#2d654f]" : "text-carbon"}`}>{seleccionado.pendiente ? "—" : moneda(seleccionado.neto)}</p></div>
    </div>
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
      const respuesta = await fetch(urlDescarga(`/dashboard/finanzas/exportar?${parametros}`), { headers: authHeaders() });
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
            {(["SEMANA", "MES", "ANIO"] as const).map((opcion) => <button key={opcion} type="button" onClick={() => setPeriodo(opcion)} aria-pressed={periodo === opcion} className={`rounded-md px-4 py-2 text-sm transition-colors ${periodo === opcion ? "bg-carbon text-white" : "text-carbon/65 hover:bg-white"}`}>{opcion === "SEMANA" ? "Semana" : opcion === "MES" ? "Mes" : "Año"}</button>)}
          </div>
          <label className="flex items-center gap-2 text-sm text-carbon/65">{periodo === "ANIO" ? "Año del reporte" : periodo === "SEMANA" ? "Fecha de la semana" : "Fecha del mes"}{periodo === "ANIO" ? <select value={fechaFinanzas.slice(0, 4)} onChange={e => setFechaFinanzas(`${e.target.value}-01-01`)} className="rounded-md border border-line bg-white px-3 py-2 text-sm text-carbon focus:border-gold focus:outline-none">{Array.from({ length: new Date().getFullYear() - 1998 }, (_, i) => new Date().getFullYear() + 1 - i).map(anio => <option key={anio} value={anio}>{anio}</option>)}</select> : <input type="date" value={fechaFinanzas} onChange={(e) => setFechaFinanzas(e.target.value)} className="rounded-md border border-line bg-white px-3 py-2 text-sm text-carbon focus:border-gold focus:outline-none" />}</label>
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
            <div className={`rounded-lg border p-4 ${(reporte?.totales.neto ?? 0) < 0 ? "border-red-300 bg-red-50" : "border-gold/25 bg-gold/5"}`}><p className="text-xs uppercase tracking-wide text-carbon/55">Resultado del período</p><p className={`mt-1 text-xl font-semibold tabular-nums ${(reporte?.totales.neto ?? 0) < 0 ? "text-red-700" : "text-carbon"}`}>{cargandoReporte ? "…" : moneda(reporte?.totales.neto ?? 0)}</p>{reporte && <p className="mt-1 text-xs text-carbon/55">Comparado con {periodo === "ANIO" ? reporte.comparacion.desde.slice(0, 4) : `${fechaCorta(reporte.comparacion.desde)} — ${fechaCorta(reporte.comparacion.hasta)}`}</p>}</div>
            <div className="rounded-lg border border-line bg-white p-4"><p className="text-xs uppercase tracking-wide text-carbon/55">Margen porcentual</p><p className={`mt-1 text-xl font-semibold tabular-nums ${(reporte?.totales.margen_porcentual ?? 0) < 0 ? "text-red-700" : "text-carbon"}`}>{cargandoReporte ? "…" : reporte?.totales.margen_porcentual === null ? "Sin ingresos" : `${reporte?.totales.margen_porcentual.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`}</p><p className="mt-1 text-xs text-carbon/55">Resultado ÷ ingresos</p></div>
          </div>
          {cargandoReporte && !reporte ? <p className="py-12 text-center text-sm text-carbon/50">Cargando movimientos financieros…</p> : reporte && <>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-carbon/50"><span>{periodo === "ANIO" ? `Año ${reporte.desde.slice(0, 4)}` : `${fechaCorta(reporte.desde)} — ${fechaCorta(reporte.hasta)}`}</span><div className="flex flex-wrap gap-x-4 gap-y-1"><span className="flex items-center gap-1.5"><i className="h-3 w-3 bg-[#008580]" />Ingresos</span><span className="flex items-center gap-1.5"><i className="h-3 w-3 bg-[#d63f3f]" />Egresos</span><span className="flex items-center gap-1.5"><i className="h-0.5 w-5 bg-[#e8b943]" />Resultado</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-danger" />Resultado negativo</span></div></div>
            <GraficoFinanciero puntos={reporte.serie} anual={periodo === "ANIO"} />
            <section className="mt-5 border-t border-line pt-5" aria-labelledby="resultado-diario-titulo">
              <h3 id="resultado-diario-titulo" className="mb-3 font-serif text-lg text-carbon">Resultado por {periodo === "ANIO" ? "mes" : "día"}</h3>
              <Table><THead><TH>{periodo === "ANIO" ? "Mes" : "Fecha"}</TH><TH className="text-right">Ingresos</TH><TH className="text-right">Egresos</TH><TH className="text-right">Resultado</TH><TH className="text-right">Margen</TH></THead><TBody>
                {reporte.serie.map(punto => <TR key={punto.fecha} className={punto.neto < 0 ? "bg-red-50" : undefined}>
                  <TD>{periodo === "ANIO" ? new Date(`${punto.fecha}T12:00:00`).toLocaleDateString("es-AR", { month: "long" }) : fechaCorta(punto.fecha)}{punto.pendiente && <span className="ml-2 text-xs text-carbon/60">Pendiente</span>}</TD>
                  <TD className="text-right tabular-nums">{punto.pendiente ? "—" : moneda(punto.ingresos)}</TD>
                  <TD className="text-right tabular-nums">{punto.pendiente ? "—" : moneda(punto.egresos)}</TD>
                  <TD className={`text-right font-medium tabular-nums ${punto.neto < 0 ? "text-red-700" : ""}`}>{punto.neto < 0 && <Badge tono="alerta">Negativo</Badge>} {punto.pendiente ? "—" : moneda(punto.neto)}</TD>
                  <TD className={`text-right tabular-nums ${punto.neto < 0 ? "text-red-700" : ""}`}>{punto.pendiente || punto.margen_porcentual === null ? "—" : `${punto.margen_porcentual.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`}</TD>
                </TR>)}
              </TBody></Table>
            </section>
          </>}
          {reporte && reporte.movimientos.length > 0 && <details className="mt-4 overflow-hidden rounded-lg border border-line"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-carbon hover:bg-bone/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gold">Ver detalle de {reporte.movimientos.length} movimiento{reporte.movimientos.length === 1 ? "" : "s"}</summary><div className="border-t border-line"><Table scrollLabel="Detalle de movimientos financieros; desplazamiento horizontal disponible" className="table-fixed min-w-[52rem]"><THead><TH className="w-28 px-4 text-[#514d46]">Fecha</TH><TH className="w-32 px-4 text-[#514d46]">Tipo</TH><TH className="px-4 text-[#514d46]">Detalle</TH><TH className="w-40 px-4 text-right text-[#514d46]">Importe</TH><TH className="w-28 px-4 text-center text-[#514d46]">Acceso</TH></THead><TBody>{reporte.movimientos.map((m, i) => <TR key={`${m.fecha}-${m.tipo}-${i}`}><TD className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums">{fechaCorta(m.fecha)}</TD><TD className="px-4 py-2.5"><Badge tono={m.tipo === "INGRESO" ? "activo" : "alerta"}>{m.tipo === "INGRESO" ? "Ingreso" : "Egreso"}</Badge></TD><TD title={m.detalle} className="break-words px-4 py-2.5 text-sm leading-5">{m.detalle}</TD><TD className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums">{moneda(m.importe)}</TD><TD className="px-4 py-2.5 text-center"><Link aria-label={`Abrir ${m.tipo === "INGRESO" ? "reservas" : "órdenes de pago"}`} className="inline-flex rounded px-2 py-1 text-sm font-medium text-[#344b58] underline decoration-[#a67d4b] underline-offset-2 hover:text-[#17252a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#805b2d]" href={m.tipo === "INGRESO" ? "/reservas" : "/proveedores/ordenes-pago"}>{m.tipo === "INGRESO" ? "Reservas" : "Órdenes"}</Link></TD></TR>)}</TBody></Table></div></details>}
          <p className="mt-3 rounded-md bg-bone/45 px-3 py-2 text-sm leading-6 text-[#514d46]">Ingresos: alojamiento y cargos de habitación cobrados. Egresos: órdenes de pago confirmadas desde la fuente compartida con REP-07. Margen: resultado del período dividido por sus ingresos; si no hubo ingresos, no se calcula.</p>
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
