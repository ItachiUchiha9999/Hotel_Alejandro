"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Card, Field, InfoBox, Input, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { LineaTiempoIngresos } from "@/components/ingresos/LineaTiempoIngresos";
import { api, urlDescarga } from "@/lib/api";
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
      <Table><THead><TH>Fecha</TH><TH>Origen</TH><TH>Reserva</TH><TH>Detalle</TH><TH className="text-right">Importe</TH></THead><TBody>
        {reporte.movimientos.slice((pagina - 1) * 20,pagina * 20).map(m => <TR key={m.id}><TD className="whitespace-nowrap">{fechaIngreso(m.fecha)}</TD><TD>{ORIGENES_INGRESOS.find(o => o.id === m.origen)?.nombre}</TD><TD className="font-mono text-xs">{m.reserva}</TD><TD>{m.detalle}</TD><TD className="text-right whitespace-nowrap tabular-nums">{monedaIngreso(m.importe)}</TD></TR>)}
      </TBody></Table>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-carbon/60"><span>{reporte.movimientos.length} cobros · Página {pagina} de {paginas}</span><div className="flex gap-2"><Button variante="secundario" tamano="sm" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Anterior</Button><Button variante="secundario" tamano="sm" disabled={pagina === paginas} onClick={() => setPagina(pagina + 1)}>Siguiente</Button></div></div>
    </>}
  </Card>;
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
      const respuesta = await fetch(urlDescarga(`/ingresos/exportar?${parametros}`));
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
        <Card titulo="Evolución de los ingresos" descripcion={`Ingreso total por ${reporte.agrupacion === "MES" ? "mes" : "semana"}. Seleccioná un punto para consultar su detalle.`}><LineaTiempoIngresos reporte={reporte} key={consulta} /></Card>
        <div className="grid gap-4 sm:grid-cols-3">{reporte.origenes.map(o => <Card key={o.id}><p className="text-xs text-carbon/60">{o.nombre}</p><p className="mt-2 text-xl font-semibold tabular-nums" style={{ color:ORIGENES_INGRESOS.find(origen => origen.id === o.id)?.color }}>{monedaIngreso(o.importe)}</p></Card>)}</div>
        <Card titulo="Resumen por período"><Table><THead><TH>Período</TH>{ORIGENES_INGRESOS.map(o => <TH key={o.id} className="text-right">{o.nombre}</TH>)}<TH className="text-right">Total</TH><TH className="text-right">Acumulado</TH></THead><TBody>
          {reporte.serie.map(p => <TR key={p.inicio}><TD className="whitespace-nowrap text-xs">{fechaIngreso(p.desde)}<br />al {fechaIngreso(p.hasta)}</TD>{ORIGENES_INGRESOS.map(o => <TD key={o.id} className="text-right whitespace-nowrap tabular-nums">{monedaIngreso(p.origenes[o.id])}</TD>)}<TD className="text-right whitespace-nowrap font-medium tabular-nums">{monedaIngreso(p.total)}</TD><TD className="text-right whitespace-nowrap tabular-nums text-carbon/60">{monedaIngreso(p.acumulado)}</TD></TR>)}
        </TBody></Table></Card>
        <DetalleCobros reporte={reporte} key={consulta} />
        <p className="text-xs leading-relaxed text-carbon/55">Se suman los cobros de alojamiento y los servicios y consumos pagados, con la fecha de cobro en horario de Argentina. Las reservas y cargos sin cobrar quedan fuera del total. La comparación usa el rango inmediatamente anterior, con la misma cantidad de días.</p>
      </div>}
    </div>
  </>;
}
