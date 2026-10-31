"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Download, Filter, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Card, EmptyState, Field, InfoBox, Input, Select, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { SkeletonTable, SkeletonKPI } from "@/components/ui/Skeleton";
import { api, authHeaders, urlDescarga } from "@/lib/api";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type CanalVenta = "DIRECTO" | "OTA" | "CORPORATIVO" | "AGENCIA";
type Agrupacion = "MES" | "SEMANA";

type MovimientoCanal = {
  id: string;
  fecha: string;
  canal: CanalVenta;
  reserva: string;
  huesped: string;
  noches: number;
  importe: number;
};

type PeriodoCanal = {
  inicio: string;
  desde: string;
  hasta: string;
  canales: Record<CanalVenta, { reservas: number; noches: number; importe: number }>;
  total: { reservas: number; noches: number; importe: number };
  acumulado: number;
};

type ReporteVentasCanal = {
  desde: string;
  hasta: string;
  agrupacion: Agrupacion;
  total: { reservas: number; noches: number; importe: number };
  porCanal: Record<CanalVenta, { reservas: number; noches: number; importe: number; porcentaje: number }>;
  serie: PeriodoCanal[];
  movimientos: MovimientoCanal[];
};

const CANALES_CONFIG: Record<CanalVenta, { label: string; color: string; icon: string }> = {
  DIRECTO: { label: "Directo", color: "#2e7d32", icon: "🏨" },
  OTA: { label: "OTA", color: "#1565c0", icon: "🌐" },
  CORPORATIVO: { label: "Corporativo", color: "#6a1b9a", icon: "🏢" },
  AGENCIA: { label: "Agencia", color: "#ef6c00", icon: "✈️" },
};

function hoyLocal() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function seleccionInicial() {
  const hoy = hoyLocal();
  return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy, agrupacion: "MES" as Agrupacion };
}

const moneda = (importe: number) => new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
}).format(importe);

const fecha = (valor: string) => format(new Date(`${valor}T12:00:00`), "dd/MM/yyyy", { locale: es });

function DetalleVentasCanal({ reporte }: { reporte: ReporteVentasCanal }) {
  const [pagina, setPagina] = useState(1);
  const paginas = Math.max(1, Math.ceil(reporte.movimientos.length / 20));
  return (
    <Card titulo="Detalle de reservas por canal" descripcion="Cada fila corresponde a una reserva confirmada con su canal de origen.">
      {!reporte.movimientos.length ? (
        <p className="py-5 text-sm text-carbon/60">No hay reservas en este período.</p>
      ) : (
        <>
          <Table className="table-fixed w-full">
            <THead>
              <TH style={{ width: '15%' }}>Fecha</TH>
              <TH style={{ width: '15%' }}>Canal</TH>
              <TH style={{ width: '20%' }}>Reserva</TH>
              <TH style={{ width: '30%' }}>Huésped</TH>
              <TH className="text-center" style={{ width: '8%' }}>Noches</TH>
              <TH className="text-right" style={{ width: '12%' }}>Importe</TH>
            </THead>
            <TBody>
              {reporte.movimientos.slice((pagina - 1) * 20, pagina * 20).map((m) => (
                <TR key={m.id}>
                  <TD className="whitespace-nowrap">{fecha(m.fecha)}</TD>
                  <TD>
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: `${CANALES_CONFIG[m.canal].color}20`, color: CANALES_CONFIG[m.canal].color }}>
                      {CANALES_CONFIG[m.canal].icon} {CANALES_CONFIG[m.canal].label}
                    </span>
                  </TD>
                  <TD className="font-mono text-xs">{m.reserva}</TD>
                  <TD>{m.huesped}</TD>
                  <TD className="text-center tabular-nums">{m.noches}</TD>
                  <TD className="whitespace-nowrap text-right tabular-nums">{moneda(m.importe)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-carbon/60">
            <span>{reporte.movimientos.length} reservas · Página {pagina} de {paginas}</span>
            <div className="flex gap-2">
              <Button variante="secundario" tamano="sm" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
              <Button variante="secundario" tamano="sm" disabled={pagina === paginas} onClick={() => setPagina(pagina + 1)}>Siguiente</Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function GraficoVentasCanal({ reporte }: { reporte: ReporteVentasCanal }) {
  const [animar, setAnimar] = useState(false);

  const anchoBarra = 48;
  const espacio = 20;
  const ancho = Math.max(760, reporte.serie.length * (anchoBarra + espacio) + 40);
  const alto = 250;
  const arriba = 12;
  const altoGrafico = 180;
  const maximo = Math.max(1, ...reporte.serie.map((p) => p.total.importe));
  const paso = anchoBarra + espacio;
  const intervaloEtiqueta = Math.max(1, Math.ceil(reporte.serie.length / 10));

  // Trigger animation on mount/data change
  useEffect(() => {
    setAnimar(false);
    requestAnimationFrame(() => setAnimar(true));
  }, [reporte.serie.length, reporte.agrupacion]);

  return (
    <Card titulo="Evolución de ingresos por canal" descripcion={`Ingresos por ${reporte.agrupacion === "MES" ? "mes" : "semana"} y canal de venta. Desplazate horizontalmente para ver todo el período.`} className="animate-slide-up-slow">
      {!reporte.serie.length ? (
        <p className="py-5 text-sm text-carbon/60">No hay períodos para graficar.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2" aria-label="Canales de venta">
            {(Object.keys(CANALES_CONFIG) as CanalVenta[]).map((canal, index) => (
              <span key={canal} className={`stagger-${index + 1} animate-slide-in inline-flex items-center gap-2 text-xs text-carbon/70`}>
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CANALES_CONFIG[canal].color }} />
                {CANALES_CONFIG[canal].label}
              </span>
            ))}
          </div>
          <div className="overflow-x-auto pb-2">
            <svg role="img" aria-label={`Gráfico de ventas por canal de ${fecha(reporte.desde)} a ${fecha(reporte.hasta)}, total ${moneda(reporte.total.importe)}`} viewBox={`0 0 ${ancho} ${alto}`} width={ancho} height={alto} className="max-w-none">
              {[0, 0.5, 1].map((fraccion, idx) => {
                const y = arriba + altoGrafico * (1 - fraccion);
                return (
                  <g key={fraccion} className={`animate-fade-in stagger-${idx + 1}`}>
                    <line x1="34" x2={ancho - 8} y1={y} y2={y} stroke="#e6e0d6" strokeDasharray={fraccion === 0 ? undefined : "3 5"} />
                    <text x="29" y={y + 4} textAnchor="end" fill="#77736d" fontSize="10">
                      {(maximo * fraccion).toLocaleString("es-AR", { notation: "compact", maximumFractionDigits: 1 })}
                    </text>
                  </g>
                );
              })}
              {reporte.serie.map((periodo, indice) => {
                const x = 42 + indice * paso;
                let yBase = arriba + altoGrafico;
                const etiqueta = new Date(`${periodo.desde}T12:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
                const delay = (indice % 8) * 60;

                if (periodo.total.importe === 0) return (
                  <g key={periodo.inicio} style={{ animationDelay: `${delay}ms` }} className="animate-slide-up-slow">
                    <rect x={x} y={arriba + altoGrafico - 2} width={anchoBarra} height={2} fill="#a9a39a"><title>{`${etiqueta} · Sin ingresos`}</title></rect>
                    {(indice % intervaloEtiqueta === 0 || indice === reporte.serie.length - 1) && (
                      <text x={x + anchoBarra / 2} y={alto - 20} textAnchor="middle" fill="#77736d" fontSize="10" className="animate-fade-in">{etiqueta}</text>
                    )}
                  </g>
                );

                return (
                  <g key={periodo.inicio} style={{ animationDelay: `${delay}ms` }} className="animate-slide-up-slow">
                    {(Object.keys(CANALES_CONFIG) as CanalVenta[]).map((canal, canalIndex) => {
                      const valor = periodo.canales[canal]?.importe || 0;
                      const altura = valor / maximo * altoGrafico;
                      if (!altura) return null;
                      yBase -= altura;
                      return (
                        <rect
                          key={canal}
                          x={x}
                          y={animar ? yBase : arriba + altoGrafico}
                          width={anchoBarra}
                          height={animar ? altura : 0}
                          fill={CANALES_CONFIG[canal].color}
                          className={`stagger-${(canalIndex % 8) + 1} animate-scale-in`}
                          style={{
                            transformOrigin: `${x + anchoBarra / 2}px ${arriba + altoGrafico}px`,
                            transition: "y 0.6s cubic-bezier(0.4, 0, 0.2, 1), height 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                            transitionDelay: `${canalIndex * 40}ms`,
                          }}
                        >
                          <title>{`${etiqueta} · ${CANALES_CONFIG[canal].label}: ${moneda(valor)}`}</title>
                        </rect>
                      );
                    })}
                    {periodo.total.importe > 0 && <title>{`${etiqueta} · Total: ${moneda(periodo.total.importe)}`}</title>}
                    {(indice % intervaloEtiqueta === 0 || indice === reporte.serie.length - 1) && (
                      <text x={x + anchoBarra / 2} y={alto - 20} textAnchor="middle" fill="#77736d" fontSize="10" className="animate-fade-in stagger-8">{etiqueta}</text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          <p className="mt-2 text-right text-xs text-carbon/55">Escala vertical: pesos argentinos · Total del período: {moneda(reporte.total.importe)}</p>
        </>
      )}
    </Card>
  );
}

export default function VentasCanalPage() {
  const [seleccion, setSeleccion] = useState(seleccionInicial);
  const [desde, setDesde] = useState(seleccion.desde);
  const [hasta, setHasta] = useState(seleccion.hasta);
  const [resultado, setResultado] = useState<{ consulta: string; reporte?: ReporteVentasCanal; error?: string } | null>(null);
  const [exportando, setExportando] = useState<"pdf" | "xlsx" | null>(null);
  const [errorExportacion, setErrorExportacion] = useState<string | null>(null);
  const [montado, setMontado] = useState(false);
  const consulta = new URLSearchParams(seleccion).toString();
  const vigente = resultado?.consulta === consulta;
  const reporte = vigente ? resultado.reporte : undefined;
  const error = vigente ? resultado.error : undefined;
  const cargando = !vigente;

  useEffect(() => {
    setMontado(true);
    const controller = new AbortController();
    api.get<ReporteVentasCanal>(`/ventas-canal?${consulta}`, { signal: controller.signal })
      .then((datos) => { if (!controller.signal.aborted) setResultado({ consulta, reporte: datos }); })
      .catch((err) => { if (!controller.signal.aborted) setResultado({ consulta, error: err instanceof Error ? err.message : "No se pudo cargar el reporte." }); });
    return () => controller.abort();
  }, [consulta]);

  function aplicar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorExportacion(null);
    setSeleccion({ desde, hasta, agrupacion: seleccion.agrupacion });
  }

  async function exportar(formato: "pdf" | "xlsx") {
    if (!reporte) return;
    setExportando(formato);
    setErrorExportacion(null);
    try {
      const parametros = new URLSearchParams({ desde: reporte.desde, hasta: reporte.hasta, agrupacion: reporte.agrupacion, formato });
      const respuesta = await fetch(urlDescarga(`/ventas-canal/exportar?${parametros}`), { headers: authHeaders() });
      if (!respuesta.ok) {
        const datos = await respuesta.json();
        throw new Error(datos.message ?? "No se pudo exportar el reporte.");
      }
      const enlace = document.createElement("a");
      const url = URL.createObjectURL(await respuesta.blob());
      enlace.href = url;
      enlace.download = `ventas-canal-${reporte.desde}-${reporte.hasta}-${reporte.agrupacion.toLowerCase()}.${formato}`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setErrorExportacion(err instanceof Error ? err.message : "No se pudo descargar el archivo.");
    } finally {
      setExportando(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="GERENCIA · REPORTES"
        titulo="Ventas por Canal"
        descripcion="Analizá la distribución de reservas e ingresos según el canal de venta (Directo, OTA, Corporativo, Agencia)."
        acciones={
          <>
            <Button variante="secundario" disabled={!montado || !reporte || exportando !== null} cargando={exportando === "pdf"} onClick={() => exportar("pdf")} leftIcon={<Download size={15} />}>PDF</Button>
            <Button variante="secundario" disabled={!montado || !reporte || exportando !== null} cargando={exportando === "xlsx"} onClick={() => exportar("xlsx")} leftIcon={<Download size={15} />}>Excel</Button>
          </>
        }
      />

      <Card className="mb-6">
        <form onSubmit={aplicar} className="flex flex-wrap items-end gap-4">
          <Field label="Desde" htmlFor="ventas-canal-desde">
            <Input id="ventas-canal-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required max={hasta || undefined} />
          </Field>
          <Field label="Hasta" htmlFor="ventas-canal-hasta">
            <Input id="ventas-canal-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} required min={desde || undefined} />
          </Field>
          <Button type="submit">Aplicar período</Button>
          <div className="ml-auto">
            <p className="mb-2 text-xs text-carbon/60">Agrupar por</p>
            <div className="inline-flex rounded-lg border border-line p-1" role="group" aria-label="Agrupación de ventas por canal">
              {(["MES", "SEMANA"] as const).map((modo) => (
                <button
                  key={modo}
                  type="button"
                  aria-pressed={seleccion.agrupacion === modo}
                  onClick={() => { setErrorExportacion(null); setSeleccion((s) => ({ ...s, agrupacion: modo })); }}
                  className={`rounded-md px-4 py-2 text-sm transition-colors ${seleccion.agrupacion === modo ? "bg-carbon text-white" : "text-carbon/70 hover:bg-bone"}`}
                >
                  {modo === "MES" ? "Mes" : "Semana"}
                </button>
              ))}
            </div>
          </div>
        </form>
        <p className="mt-4 text-xs text-carbon/55">Período aplicado: {fecha(seleccion.desde)} al {fecha(seleccion.hasta)}. Las semanas empiezan el lunes.</p>
      </Card>

      {errorExportacion && <div className="mb-5"><InfoBox tipo="error">{errorExportacion}</InfoBox></div>}
      {error && <InfoBox tipo="error">{error}</InfoBox>}

      <div aria-busy={cargando}>
        {cargando && <p role="status" className="py-14 text-center text-sm text-carbon/60">Cargando ventas por canal…</p>}
        {reporte && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="stagger-1 animate-slide-up-slow">
                <p className="text-xs uppercase tracking-wider text-carbon/50">Reservas totales</p>
                <p className="mt-3 text-2xl font-semibold tabular-nums">{reporte.total.reservas.toLocaleString("es-AR")}</p>
                <p className="mt-2 text-xs text-carbon/50">{reporte.total.noches} noches totales</p>
              </Card>
              <Card className="stagger-2 animate-slide-up-slow">
                <p className="text-xs uppercase tracking-wider text-carbon/50">Ingresos totales</p>
                <p className="mt-3 text-2xl font-semibold tabular-nums">{moneda(reporte.total.importe)}</p>
                <p className="mt-2 text-xs text-carbon/50">Pesos argentinos</p>
              </Card>
              <Card className="stagger-3 animate-slide-up-slow">
                <p className="text-xs uppercase tracking-wider text-carbon/50">Canal principal</p>
                <p className="mt-3 text-2xl font-semibold">
                  {(Object.entries(reporte.porCanal).sort((a, b) => b[1].importe - a[1].importe)[0] ? CANALES_CONFIG[Object.entries(reporte.porCanal).sort((a, b) => b[1].importe - a[1].importe)[0][0] as CanalVenta].label : CANALES_CONFIG.DIRECTO.label)}
                </p>
                <p className="mt-2 text-xs text-carbon/50">Por volumen de ingresos</p>
              </Card>
              <Card className="stagger-4 animate-slide-up-slow">
                <p className="text-xs uppercase tracking-wider text-carbon/50">ADR promedio</p>
                <p className="mt-3 text-2xl font-semibold tabular-nums">
                  {reporte.total.noches > 0 ? moneda(reporte.total.importe / reporte.total.noches) : "$0"}
                </p>
                <p className="mt-2 text-xs text-carbon/50">Ingreso por noche vendida</p>
              </Card>
            </div>

            {reporte.total.reservas === 0 && (
              <InfoBox className="animate-slide-up-slow">No hay reservas confirmadas en el período seleccionado.</InfoBox>
            )}

            {/* Distribución por canal - Donut chart */}
            <Card titulo="Distribución de ingresos por canal" descripcion="Participación de cada canal de venta en los ingresos totales." className="animate-slide-up-slow">
              <DonutChartVentasCanal reporte={reporte} />
            </Card>

            {/* Comparativa por canal - Grouped bar chart */}
            <Card titulo="Comparativa por canal" descripcion="Reservas, noches e ingresos por canal de venta." className="animate-slide-up-slow">
              <BarrasComparativaCanales reporte={reporte} />
            </Card>

            {/* Resumen por canal */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {(Object.keys(CANALES_CONFIG) as CanalVenta[]).map((canal, index) => {
                const data = reporte.porCanal[canal];
                const participacion = reporte.total.importe ? data.importe / reporte.total.importe * 100 : 0;
                return (
                  <Card key={canal} className={`stagger-${index + 1} animate-slide-up-slow`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-carbon/65">{CANALES_CONFIG[canal].label}</p>
                      <span className="text-xs tabular-nums text-carbon/55">{participacion.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%</span>
                    </div>
                    <p className="mt-2 text-lg font-semibold tabular-nums" style={{ color: CANALES_CONFIG[canal].color }}>{moneda(data.importe)}</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-bone-dark">
                      <div className="animate-scale-in h-full rounded-full" style={{ width: `${participacion}%`, backgroundColor: CANALES_CONFIG[canal].color }} />
                    </div>
                    <p className="mt-2 text-xs text-carbon/55">
                      {data.reservas} reserva{data.reservas !== 1 ? "s" : ""} · {data.noches} noche{data.noches !== 1 ? "s" : ""}
                      · ADR {moneda(data.noches > 0 ? data.importe / data.noches : 0)}
                    </p>
                  </Card>
                );
              })}
            </div>

            {/* Gráfico */}
            <GraficoVentasCanal reporte={reporte} />

            {/* Resumen por período */}
            <Card titulo="Resumen por período" descripcion={`Ingresos y reservas por ${reporte.agrupacion === "MES" ? "mes" : "semana"} y canal, con acumulado.`} className="animate-slide-up-slow">
              <Table className="table-fixed w-full">
                <THead>
                  <TH style={{ width: '18%' }}>Período</TH>
                  {(Object.keys(CANALES_CONFIG) as CanalVenta[]).map((canal) => (
                    <TH key={canal} className="text-right" style={{ width: '14%' }}>{CANALES_CONFIG[canal].label}</TH>
                  ))}
                  <TH className="text-right" style={{ width: '16%' }}>Total</TH>
                  <TH className="text-right" style={{ width: '16%' }}>Acumulado</TH>
                </THead>
                <TBody>
                  {reporte.serie.map((periodo, index) => (
                    <TR key={periodo.inicio} className={`stagger-${(index % 8) + 1} animate-slide-up-slow`}>
                      <TD className="whitespace-nowrap text-xs">
                        {fecha(periodo.desde)}<br />al {fecha(periodo.hasta)}
                      </TD>
                      {(Object.keys(CANALES_CONFIG) as CanalVenta[]).map((canal) => (
                        <TD key={canal} className="whitespace-nowrap text-right tabular-nums">
                          {moneda(periodo.canales[canal]?.importe || 0)}
                        </TD>
                      ))}
                      <TD className="whitespace-nowrap text-right font-medium tabular-nums">{moneda(periodo.total.importe)}</TD>
                      <TD className="whitespace-nowrap text-right tabular-nums text-carbon/60">{moneda(periodo.acumulado)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>

            <DetalleVentasCanal reporte={reporte} key={consulta} />

            <p className="animate-slide-up-slow text-xs leading-relaxed text-carbon/55">
              Se consideran las reservas confirmadas (con check-in realizado o estado CONFIRMADA/FINALIZADA) y su canal de origen.
              El canal se determina por la fuente de la reserva: Directo (web/teléfono), OTA (Booking, Expedia, etc.), Corporativo (empresas convenio), Agencia (agencias de viajes).
              Los importes corresponden al alojamiento facturado/cobrado.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

/* Donut chart for sales distribution by channel */
function DonutChartVentasCanal({ reporte }: { reporte: ReporteVentasCanal }) {
  const [animar, setAnimar] = useState(false);
  useEffect(() => { setAnimar(false); requestAnimationFrame(() => setAnimar(true)); }, [reporte.total.importe]);

  const radio = 80;
  const grosor = 18;
  const circunferencia = 2 * Math.PI * radio;
  const canalesConImporte = (Object.keys(CANALES_CONFIG) as CanalVenta[]).filter(c => reporte.porCanal[c]?.importe > 0);
  let acumulado = 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-[220px]">
      <svg viewBox={`0 0 ${radio * 2} ${radio * 2}`} width="180" height="180" role="img" aria-label="Distribución de ingresos por canal de venta">
        {canalesConImporte.map((c, idx) => {
          const config = CANALES_CONFIG[c];
          const porcentaje = reporte.total.importe ? (reporte.porCanal[c].importe / reporte.total.importe) : 0;
          const dashArray = `${porcentaje * circunferencia} ${circunferencia}`;
          const dashOffset = -acumulado / reporte.total.importe * circunferencia;
          const startAngle = (acumulado / reporte.total.importe) * 2 * Math.PI - Math.PI / 2;
          acumulado += reporte.porCanal[c].importe;
          return (
            <circle
              key={c}
              cx={radio} cy={radio} r={radio - grosor / 2}
              fill="none" stroke={config.color}
              strokeWidth={grosor}
              strokeDasharray={dashArray}
              strokeDashoffset={animar ? dashOffset : circunferencia}
              strokeLinecap="round"
              className={`stagger-${(idx % 6) + 1} animate-scale-in`}
              style={{
                transformOrigin: `${radio}px ${radio}px`,
                transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
                transitionDelay: `${idx * 80}ms`,
              }}
            >
              <title>{config.label}: {moneda(reporte.porCanal[c].importe)} ({(porcentaje * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%)</title>
            </circle>
          );
        })}
        {reporte.total.importe === 0 && (
          <circle cx={radio} cy={radio} r={radio - grosor / 2} fill="none" stroke="#e6e0d6" strokeWidth={grosor} />
        )}
      </svg>
      <p className="mt-4 text-center text-sm font-medium text-carbon">{moneda(reporte.total.importe)}</p>
      <p className="text-xs text-carbon/50">Ingresos totales</p>
    </div>
  );
}

/* Grouped bar chart comparing channels by reservations, nights, income */
function BarrasComparativaCanales({ reporte }: { reporte: ReporteVentasCanal }) {
  const [animar, setAnimar] = useState(false);
  useEffect(() => { setAnimar(false); requestAnimationFrame(() => setAnimar(true)); }, [reporte.total.importe]);

  const canales = (Object.keys(CANALES_CONFIG) as CanalVenta[]).filter(c => reporte.porCanal[c]?.importe > 0 || reporte.porCanal[c]?.reservas > 0 || reporte.porCanal[c]?.noches > 0);
  const metricas = [
    { key: "reservas", label: "Reservas", color: "#3f7a5e", formatter: (v: number) => v.toLocaleString("es-AR") },
    { key: "noches", label: "Noches", color: "#3d6b87", formatter: (v: number) => v.toLocaleString("es-AR") },
    { key: "importe", label: "Ingresos", color: "#b08d48", formatter: (v: number) => moneda(v) },
  ] as const;

  const maximo = Math.max(1, ...canales.flatMap(c => metricas.map(m => reporte.porCanal[c]?.[m.key] ?? 0)));
  const anchoBarra = 24;
  const espacioMetrica = 6;
  const espacioCanal = 20;
  const anchoGrupo = metricas.length * anchoBarra + (metricas.length - 1) * espacioMetrica;
  const ancho = Math.max(700, canales.length * (anchoGrupo + espacioCanal) + 80);
  const alto = 220;
  const arriba = 25;
  const altoGrafico = 160;
  const y = (valor: number) => arriba + altoGrafico - (valor / maximo) * altoGrafico;
  const compacto = (valor: number) => new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(valor);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${ancho} ${alto}`} width={ancho} height={alto} className="max-w-none" role="img" aria-label="Comparativa de reservas, noches e ingresos por canal de venta">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(fraccion => (
          <g key={fraccion} className="animate-fade-in stagger-1">
            <line x1="60" x2={ancho - 10} y1={y(maximo * fraccion)} y2={y(maximo * fraccion)} stroke="#e8e0d4" strokeDasharray="4 5" />
            <text x="55" y={y(maximo * fraccion) + 4} textAnchor="end" fontSize="10" fill="#756f67">{compacto(maximo * fraccion)}</text>
          </g>
        ))}
        {/* Bars */}
        {canales.map((canal, idx) => {
          const config = CANALES_CONFIG[canal];
          const data = reporte.porCanal[canal];
          const xBase = 70 + idx * (anchoGrupo + espacioCanal);
          return (
            <g key={canal} style={{ animationDelay: `${(idx % 8) * 80}ms` }} className="animate-slide-up-slow">
              {metricas.map((m, mIdx) => {
                const x = xBase + mIdx * (anchoBarra + espacioMetrica);
                const valor = data?.[m.key] ?? 0;
                return (
                  <rect
                    key={m.key}
                    x={x} y={animar ? y(valor) : arriba + altoGrafico}
                    width={anchoBarra} height={animar ? (arriba + altoGrafico - y(valor)) : 0}
                    fill={m.color} rx={3}
                    className={`stagger-${(mIdx % 6) + 1} animate-scale-in`}
                    style={{
                      transformOrigin: `${x + anchoBarra / 2}px ${arriba + altoGrafico}px`,
                      transition: "y 0.6s cubic-bezier(0.4, 0, 0.2, 1), height 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                      transitionDelay: `${mIdx * 40}ms`,
                    }}
                  >
                    <title>{config.label} - {m.label}: {m.formatter(valor)}</title>
                  </rect>
                );
              })}
              {/* Channel label */}
              <text x={xBase + anchoGrupo / 2} y={alto - 8} textAnchor="middle" fontSize="10" fill="#756f67" className="animate-fade-in stagger-5">{config.label}</text>
            </g>
          );
        })}
        {/* Legend */}
        <g className="animate-fade-in stagger-1" transform={`translate(${ancho / 2 - 150}, ${alto - 5})`}>
          {metricas.map((m, i) => (
            <g key={m.key} transform={`translate(${i * 100}, 0)`}>
              <rect x={0} y={0} width={12} height={12} rx={2} fill={m.color} />
              <text x={16} y={10} fontSize="11" fill="#756f67">{m.label}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}