"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Download, PieChart, BarChart2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Card, Field, InfoBox, Input, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { LineaTiempoIngresos } from "@/components/ingresos/LineaTiempoIngresos";
import { api, authHeaders, urlDescarga } from "@/lib/api";
import { ORIGENES_INGRESOS, fechaIngreso, monedaIngreso, type AgrupacionIngresos, type ReporteIngresos } from "@/lib/ingresos";

function seleccionInicial() {
  const hoy = new Intl.DateTimeFormat("en-CA",{ timeZone:"America/Argentina/Buenos_Aires",year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date());
  return { desde:`${hoy.slice(0,4)}-01-01`,hasta:hoy,agrupacion:"MES" as AgrupacionIngresos };
}

function DetalleCobros({ reporte }: { reporte: ReporteIngresos }) {
  const [pagina,setPagina] = useState(1);
  const paginas = Math.max(1,Math.ceil(reporte.movimientos.length / 20));
  return <Card titulo="Detalle de cobros" descripcion="Los archivos exportados incluyen todos los cobros del período.">
    {!reporte.movimientos.length ? <p className="py-5 text-sm text-carbon/60">No hay ingresos cobrados en este período.</p> : <>
      <Table className="table-fixed w-full"><THead><TH style={{ width: '15%' }}>Fecha</TH><TH style={{ width: '18%' }}>Origen</TH><TH style={{ width: '18%' }}>Reserva</TH><TH style={{ width: '30%' }}>Detalle</TH><TH className="text-right" style={{ width: '19%' }}>Importe</TH></THead><TBody>
        {reporte.movimientos.slice((pagina - 1) * 20,pagina * 20).map(m => <TR key={m.id}><TD className="whitespace-nowrap">{fechaIngreso(m.fecha)}</TD><TD>{ORIGENES_INGRESOS.find(o => o.id === m.origen)?.nombre}</TD><TD className="font-mono text-xs">{m.reserva}</TD><TD>{m.detalle}</TD><TD className="text-right whitespace-nowrap tabular-nums">{monedaIngreso(m.importe)}</TD></TR>)}
      </TBody></Table>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-carbon/60"><span>{reporte.movimientos.length} cobros · Página {pagina} de {paginas}</span><div className="flex gap-2"><Button variante="secundario" tamano="sm" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Anterior</Button><Button variante="secundario" tamano="sm" disabled={pagina === paginas} onClick={() => setPagina(pagina + 1)}>Siguiente</Button></div></div>
    </>}
  </Card>;
}

/* Donut chart for income distribution by origin */
function DonutChartIngresos({ reporte }: { reporte: ReporteIngresos }) {
  const [animar, setAnimar] = useState(false);
  useEffect(() => { setAnimar(false); requestAnimationFrame(() => setAnimar(true)); }, [reporte.total]);

  const radio = 80;
  const grosor = 18;
  const circunferencia = 2 * Math.PI * radio;
  const origenesConImporte = reporte.origenes.filter(o => o.importe > 0);
  let acumulado = 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-[220px]">
      <svg viewBox={`0 0 ${radio * 2} ${radio * 2}`} width="180" height="180" role="img" aria-label="Distribución de ingresos por origen">
        {origenesConImporte.map((o, idx) => {
          const origenConfig = ORIGENES_INGRESOS.find(origen => origen.id === o.id);
          const porcentaje = reporte.total ? (o.importe / reporte.total) : 0;
          const dashArray = `${porcentaje * circunferencia} ${circunferencia}`;
          const dashOffset = -acumulado / reporte.total * circunferencia;
          const startAngle = (acumulado / reporte.total) * 2 * Math.PI - Math.PI / 2;
          const isLarge = porcentaje > 0.5 ? 1 : 0;
          const x = radio + radio * Math.cos(startAngle);
          const y = radio + radio * Math.sin(startAngle);
          acumulado += o.importe;
          return (
            <circle
              key={o.id}
              cx={radio} cy={radio} r={radio - grosor / 2}
              fill="none" stroke={origenConfig?.color}
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
              <title>{origenConfig?.nombre}: {monedaIngreso(o.importe)} ({(porcentaje * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%)</title>
            </circle>
          );
        })}
        {reporte.total === 0 && (
          <circle cx={radio} cy={radio} r={radio - grosor / 2} fill="none" stroke="#e6e0d6" strokeWidth={grosor} />
        )}
      </svg>
      <p className="mt-4 text-center text-sm font-medium text-carbon">{monedaIngreso(reporte.total)}</p>
      <p className="text-xs text-carbon/50">Total del período</p>
    </div>
  );
}

/* Bar chart showing total income per period (from serie data) */
function BarrasPeriodosIngresos({ reporte }: { reporte: ReporteIngresos }) {
  const [animar, setAnimar] = useState(false);
  useEffect(() => { setAnimar(false); requestAnimationFrame(() => setAnimar(true)); }, [reporte.serie]);

  const maximo = Math.max(1, ...reporte.serie.map(p => p.total));
  const anchoBarra = Math.max(24, Math.min(52, 760 / Math.max(1, reporte.serie.length) - 12));
  const espacio = 12;
  const ancho = Math.max(760, reporte.serie.length * (anchoBarra + espacio) + 60);
  const alto = 200;
  const arriba = 20;
  const altoGrafico = 150;
  const y = (valor: number) => arriba + altoGrafico - (valor / maximo) * altoGrafico;
  const compacto = (valor: number) => new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(valor);
  const etiqueta = (valor: string) => reporte.agrupacion === "MES" ? new Date(`${valor}T12:00:00Z`).toLocaleDateString("es-AR", { month: "short", year: "2-digit", timeZone: "UTC" }) : `${valor.slice(8, 10)}/${valor.slice(5, 7)}`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${ancho} ${alto}`} width={ancho} height={alto} className="max-w-none" role="img" aria-label={`Ingreso total por ${reporte.agrupacion === "MES" ? "mes" : "semana"}`}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(fraccion => (
          <g key={fraccion} className="animate-fade-in stagger-1">
            <line x1="50" x2={ancho - 10} y1={y(maximo * fraccion)} y2={y(maximo * fraccion)} stroke="#e8e0d4" strokeDasharray="4 5" />
            <text x="45" y={y(maximo * fraccion) + 4} textAnchor="end" fontSize="10" fill="#756f67">{compacto(maximo * fraccion)}</text>
          </g>
        ))}
        {/* Bars */}
        {reporte.serie.map((p, idx) => {
          const x = 55 + idx * (anchoBarra + espacio);
          const delay = (idx % 8) * 60;
          return (
            <g key={p.inicio} style={{ animationDelay: `${delay}ms` }} className="animate-slide-up-slow">
              <rect
                x={x} y={animar ? y(p.total) : arriba + altoGrafico}
                width={anchoBarra} height={animar ? (arriba + altoGrafico - y(p.total)) : 0}
                fill="#b08d48" rx={3}
                className="stagger-1 animate-scale-in"
                style={{
                  transformOrigin: `${x + anchoBarra / 2}px ${arriba + altoGrafico}px`,
                  transition: "y 0.6s cubic-bezier(0.4, 0, 0.2, 1), height 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <title>{etiqueta(p.inicio)}: {monedaIngreso(p.total)}</title>
              </rect>
              <text x={x + anchoBarra / 2} y={alto - 8} textAnchor="middle" fontSize="10" fill="#756f67" className="animate-fade-in stagger-2">{etiqueta(p.inicio)}</text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-right text-xs text-carbon/55">Escala vertical: pesos argentinos</p>
    </div>
  );
}

export default function IngresosPage() {
  const [seleccion,setSeleccion] = useState(seleccionInicial);
  const [desde,setDesde] = useState(seleccion.desde);
  const [hasta,setHasta] = useState(seleccion.hasta);
  const [resultado,setResultado] = useState<{ consulta:string; reporte?:ReporteIngresos; error?:string } | null>(null);
  const [exportando,setExportando] = useState<"pdf" | "xlsx" | null>(null);
  const [errorExportacion,setErrorExportacion] = useState<string | null>(null);
  const consulta = new URLSearchParams(seleccion).toString();
  const vigente = resultado?.consulta === consulta;
  const reporte = vigente ? resultado.reporte : undefined;
  const error = vigente ? resultado.error : undefined;
  const cargando = !vigente;

  useEffect(() => {
    const controller = new AbortController();
    api.get<ReporteIngresos>(`/ingresos?${consulta}`,{ signal:controller.signal })
      .then(datos => { if (!controller.signal.aborted) setResultado({ consulta,reporte:datos }); })
      .catch(err => { if (!controller.signal.aborted) setResultado({ consulta,error:err instanceof Error ? err.message : "No se pudo cargar el reporte." }); });
    return () => controller.abort();
  },[consulta]);

  function aplicar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setErrorExportacion(null); setSeleccion({ desde,hasta,agrupacion:seleccion.agrupacion });
  }
  async function exportar(formato: "pdf" | "xlsx") {
    if (!reporte) return;
    setExportando(formato); setErrorExportacion(null);
    try {
      const parametros = new URLSearchParams({ desde:reporte.desde,hasta:reporte.hasta,agrupacion:reporte.agrupacion,formato });
      const respuesta = await fetch(urlDescarga(`/ingresos/exportar?${parametros}`), { headers: authHeaders() });
      if (!respuesta.ok) { const datos = await respuesta.json(); throw new Error(datos.message ?? "No se pudo exportar el reporte."); }
      const enlace = document.createElement("a"); const url = URL.createObjectURL(await respuesta.blob());
      enlace.href = url; enlace.download = `ingresos-${reporte.desde}-${reporte.hasta}-${reporte.agrupacion.toLowerCase()}.${formato}`;
      document.body.appendChild(enlace); enlace.click(); enlace.remove(); window.setTimeout(() => URL.revokeObjectURL(url),1000);
    } catch (err) { setErrorExportacion(err instanceof Error ? err.message : "No se pudo descargar el archivo."); }
    finally { setExportando(null); }
  }

  const porcentaje = reporte?.comparacion.variacion_porcentual;
  const variacion = porcentaje === null ? "Sin base de comparación" : porcentaje === undefined ? "" : `${porcentaje > 0 ? "+" : ""}${porcentaje.toLocaleString("es-AR",{ maximumFractionDigits:2 })}%`;
  return <>
    <PageHeader eyebrow="GERENCIA · REPORTES" titulo="Ingresos" descripcion="Seguí la evolución de los ingresos por reservas, servicios y consumos."
      acciones={<><Button variante="secundario" disabled={!reporte || exportando !== null} cargando={exportando === "pdf"} onClick={() => exportar("pdf")}><Download size={15} />PDF</Button><Button variante="secundario" disabled={!reporte || exportando !== null} cargando={exportando === "xlsx"} onClick={() => exportar("xlsx")}><Download size={15} />Excel</Button></>} />
    <Card className="mb-6"><form onSubmit={aplicar} className="flex flex-wrap items-end gap-4">
      <Field label="Desde" htmlFor="ingresos-desde"><Input id="ingresos-desde" type="date" value={desde} onChange={e => setDesde(e.target.value)} required max={hasta || undefined} /></Field>
      <Field label="Hasta" htmlFor="ingresos-hasta"><Input id="ingresos-hasta" type="date" value={hasta} onChange={e => setHasta(e.target.value)} required min={desde || undefined} /></Field>
      <Button type="submit">Aplicar período</Button>
      <div className="ml-auto"><p className="mb-2 text-xs text-carbon/60">Agrupar por</p><div className="inline-flex rounded-lg border border-line p-1" role="group" aria-label="Agrupación de ingresos">{(["MES","SEMANA"] as const).map(modo => <button key={modo} type="button" aria-pressed={seleccion.agrupacion === modo} onClick={() => { setErrorExportacion(null); setSeleccion(s => ({ ...s,agrupacion:modo })); }} className={`rounded-md px-4 py-2 text-sm transition-colors ${seleccion.agrupacion === modo ? "bg-carbon text-white" : "text-carbon/70 hover:bg-bone"}`}>{modo === "MES" ? "Mes" : "Semana"}</button>)}</div></div>
    </form><p className="mt-4 text-xs text-carbon/55">Período aplicado: {fechaIngreso(seleccion.desde)} al {fechaIngreso(seleccion.hasta)}. Las semanas empiezan el lunes.</p></Card>
    {errorExportacion && <div className="mb-5"><InfoBox tipo="error">{errorExportacion}</InfoBox></div>}
    {error && <InfoBox tipo="error">{error}</InfoBox>}
    <div aria-busy={cargando}>
      {cargando && <p role="status" className="py-14 text-center text-sm text-carbon/60">Cargando ingresos…</p>}
      {reporte && <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><p className="text-xs uppercase tracking-wider text-carbon/50">Total del período</p><p className="mt-3 text-2xl font-semibold tabular-nums">{monedaIngreso(reporte.total)}</p><p className="mt-2 text-xs text-carbon/50">{reporte.cantidad_cobros} cobros · Pesos argentinos</p></Card>
          <Card><p className="text-xs uppercase tracking-wider text-carbon/50">Variación respecto del anterior</p><p className={`mt-3 text-2xl font-semibold ${porcentaje != null && porcentaje < 0 ? "text-danger" : porcentaje != null && porcentaje > 0 ? "text-success" : "text-carbon"}`}>{variacion}</p><p className="mt-2 text-xs text-carbon/50">{porcentaje === null ? "El período anterior no tuvo ingresos" : `Diferencia: ${monedaIngreso(reporte.comparacion.diferencia)}`}</p></Card>
          <Card><p className="text-xs uppercase tracking-wider text-carbon/50">Total del período anterior</p><p className="mt-3 text-2xl font-semibold tabular-nums">{monedaIngreso(reporte.comparacion.total)}</p><p className="mt-2 text-xs text-carbon/50">{fechaIngreso(reporte.comparacion.desde)} al {fechaIngreso(reporte.comparacion.hasta)} · {reporte.comparacion.dias} días</p></Card>
        </div>
        {reporte.total === 0 && <InfoBox>No hay ingresos cobrados en el período seleccionado. Podés elegir otras fechas o exportar el reporte sin movimientos.</InfoBox>}

        {/* Distribución por origen - Donut chart */}
        <Card titulo="Distribución por origen" descripcion="Participación de cada tipo de ingreso en el total del período." className="animate-slide-up-slow">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="w-full md:w-1/2">
              <DonutChartIngresos reporte={reporte} />
            </div>
            <div className="w-full md:w-1/2 space-y-3">
              {reporte.origenes.map((o, idx) => {
                const origenConfig = ORIGENES_INGRESOS.find(origen => origen.id === o.id);
                const porcentaje = reporte.total ? (o.importe / reporte.total) * 100 : 0;
                return (
                  <div key={o.id} className={`stagger-${idx + 1} animate-slide-in flex items-center gap-3`}>
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: origenConfig?.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-carbon truncate">{origenConfig?.nombre ?? o.id}</p>
                      <div className="h-1.5 bg-bone-dark rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${porcentaje}%`, backgroundColor: origenConfig?.color }} />
                      </div>
                    </div>
                    <div className="text-right w-32 flex-shrink-0">
                      <p className="text-sm font-semibold tabular-nums" style={{ color: origenConfig?.color }}>{monedaIngreso(o.importe)}</p>
                      <p className="text-xs text-carbon/50">{porcentaje.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Barras por período - Bar chart from serie data */}
        <Card titulo="Ingreso total por período" descripcion={`Total por ${reporte.agrupacion === "MES" ? "mes" : "semana"} en el rango seleccionado.`} className="animate-slide-up-slow">
          <BarrasPeriodosIngresos reporte={reporte} />
        </Card>

        {/* Evolución temporal - Line chart */}
        <Card titulo="Evolución de los ingresos" descripcion={`Ingreso total por ${reporte.agrupacion === "MES" ? "mes" : "semana"}. Seleccioná un punto para consultar su detalle.`}><LineaTiempoIngresos reporte={reporte} key={consulta} /></Card>
        <div className="grid gap-4 sm:grid-cols-3">{reporte.origenes.map(o => <Card key={o.id}><p className="text-xs text-carbon/60">{o.nombre}</p><p className="mt-2 text-xl font-semibold tabular-nums" style={{ color:ORIGENES_INGRESOS.find(origen => origen.id === o.id)?.color }}>{monedaIngreso(o.importe)}</p></Card>)}</div>
        <Card titulo="Resumen por período"><Table className="table-fixed w-full"><THead><TH style={{ width: '15%' }}>Período</TH>{ORIGENES_INGRESOS.map(o => <TH key={o.id} className="text-right" style={{ width: '18%' }}>{o.nombre}</TH>)}<TH className="text-right" style={{ width: '15%' }}>Total</TH><TH className="text-right" style={{ width: '15%' }}>Acumulado</TH></THead><TBody>
          {reporte.serie.map(p => <TR key={p.inicio}><TD className="whitespace-nowrap text-xs">{fechaIngreso(p.desde)}<br />al {fechaIngreso(p.hasta)}</TD>{ORIGENES_INGRESOS.map(o => <TD key={o.id} className="text-right whitespace-nowrap tabular-nums">{monedaIngreso(p.origenes[o.id])}</TD>)}<TD className="text-right whitespace-nowrap font-medium tabular-nums">{monedaIngreso(p.total)}</TD><TD className="text-right whitespace-nowrap tabular-nums text-carbon/60">{monedaIngreso(p.acumulado)}</TD></TR>)}
        </TBody></Table></Card>
        <DetalleCobros reporte={reporte} key={consulta} />
        <p className="text-xs leading-relaxed text-carbon/55">Se suman los cobros de alojamiento y los servicios y consumos pagados, con la fecha de cobro en horario de Argentina. Las reservas y cargos sin cobrar quedan fuera del total. La comparación usa el rango inmediatamente anterior, con la misma cantidad de días.</p>
      </div>}
    </div>
  </>;
}
