"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Card, Field, InfoBox, Input, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { api, urlDescarga } from "@/lib/api";

type CategoriaId = "PROVEEDORES" | "COMPRAS_STOCK" | "GASTOS_OPERATIVOS";
type Agrupacion = "MES" | "SEMANA";
type Categoria = { id: CategoriaId; nombre: string; importe: number };
type Movimiento = {
  id: string;
  fecha: string;
  categoria: CategoriaId;
  detalle: string;
  proveedor: string;
  payment_order_id: number;
  importe: number;
};
type Periodo = {
  inicio: string;
  desde: string;
  hasta: string;
  categorias: Record<CategoriaId, number>;
  total: number;
  acumulado: number;
};
type ReporteEgresos = {
  desde: string;
  hasta: string;
  agrupacion: Agrupacion;
  total: number;
  categoria_principal: (Categoria & { porcentaje: number }) | null;
  categorias: Categoria[];
  serie: Periodo[];
  movimientos: Movimiento[];
};

const COLORES: Record<CategoriaId, string> = {
  PROVEEDORES: "#3d6b87",
  COMPRAS_STOCK: "#b8893f",
  GASTOS_OPERATIVOS: "#bd6b57",
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
}).format(importe);

const fecha = (valor: string) => new Intl.DateTimeFormat("es-AR", {
  timeZone: "UTC",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
}).format(new Date(`${valor}T00:00:00Z`));

function DetalleEgresos({ reporte }: { reporte: ReporteEgresos }) {
  const [pagina, setPagina] = useState(1);
  const paginas = Math.max(1, Math.ceil(reporte.movimientos.length / 20));
  return <Card titulo="Detalle de egresos" descripcion="Cada importe corresponde a un comprobante aplicado a una orden de pago confirmada.">
    {!reporte.movimientos.length ? <p className="py-5 text-sm text-carbon/60">No hay egresos en este período.</p> : <>
      <Table><THead><TH>Fecha</TH><TH>Categoría</TH><TH>Proveedor</TH><TH>Comprobante</TH><TH className="text-right">Importe</TH></THead><TBody>
        {reporte.movimientos.slice((pagina - 1) * 20, pagina * 20).map(movimiento => <TR key={movimiento.id}>
          <TD className="whitespace-nowrap">{fecha(movimiento.fecha)}</TD>
          <TD>{movimiento.categoria === "PROVEEDORES" ? "Pagos a proveedores" : movimiento.categoria === "COMPRAS_STOCK" ? "Compras de stock" : "Gastos operativos"}</TD>
          <TD>{movimiento.proveedor}</TD>
          <TD>{movimiento.detalle}</TD>
          <TD className="whitespace-nowrap text-right tabular-nums">{moneda(movimiento.importe)}</TD>
        </TR>)}
      </TBody></Table>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-carbon/60">
        <span>{reporte.movimientos.length} movimientos · Página {pagina} de {paginas}</span>
        <div className="flex gap-2">
          <Button variante="secundario" tamano="sm" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
          <Button variante="secundario" tamano="sm" disabled={pagina === paginas} onClick={() => setPagina(pagina + 1)}>Siguiente</Button>
        </div>
      </div>
    </>}
  </Card>;
}

export default function EgresosPage() {
  const [seleccion, setSeleccion] = useState(seleccionInicial);
  const [desde, setDesde] = useState(seleccion.desde);
  const [hasta, setHasta] = useState(seleccion.hasta);
  const [resultado, setResultado] = useState<{ consulta: string; reporte?: ReporteEgresos; error?: string } | null>(null);
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
    api.get<ReporteEgresos>(`/egresos?${consulta}`, { signal: controller.signal })
      .then(datos => { if (!controller.signal.aborted) setResultado({ consulta, reporte: datos }); })
      .catch(err => { if (!controller.signal.aborted) setResultado({ consulta, error: err instanceof Error ? err.message : "No se pudo cargar el reporte." }); });
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
      const respuesta = await fetch(urlDescarga(`/egresos/exportar?${parametros}`));
      if (!respuesta.ok) {
        const datos = await respuesta.json();
        throw new Error(datos.message ?? "No se pudo exportar el reporte.");
      }
      const enlace = document.createElement("a");
      const url = URL.createObjectURL(await respuesta.blob());
      enlace.href = url;
      enlace.download = `egresos-${reporte.desde}-${reporte.hasta}-${reporte.agrupacion.toLowerCase()}.${formato}`;
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

  return <>
    <PageHeader eyebrow="GERENCIA · REPORTES" titulo="Egresos" descripcion="Seguí las salidas de dinero por período y categoría."
      acciones={<>
        <Button variante="secundario" disabled={!montado || !reporte || exportando !== null} cargando={exportando === "pdf"} onClick={() => exportar("pdf")}><Download size={15} />PDF</Button>
        <Button variante="secundario" disabled={!montado || !reporte || exportando !== null} cargando={exportando === "xlsx"} onClick={() => exportar("xlsx")}><Download size={15} />Excel</Button>
      </>} />

    <Card className="mb-6"><form onSubmit={aplicar} className="flex flex-wrap items-end gap-4">
      <Field label="Desde" htmlFor="egresos-desde"><Input id="egresos-desde" type="date" value={desde} onChange={evento => setDesde(evento.target.value)} required max={hasta || undefined} /></Field>
      <Field label="Hasta" htmlFor="egresos-hasta"><Input id="egresos-hasta" type="date" value={hasta} onChange={evento => setHasta(evento.target.value)} required min={desde || undefined} /></Field>
      <Button type="submit">Aplicar período</Button>
      <div className="ml-auto">
        <p className="mb-2 text-xs text-carbon/60">Agrupar por</p>
        <div className="inline-flex rounded-lg border border-line p-1" role="group" aria-label="Agrupación de egresos">
          {(["MES", "SEMANA"] as const).map(modo => <button key={modo} type="button" aria-pressed={seleccion.agrupacion === modo}
            onClick={() => { setErrorExportacion(null); setSeleccion(actual => ({ ...actual, agrupacion: modo })); }}
            className={`rounded-md px-4 py-2 text-sm transition-colors ${seleccion.agrupacion === modo ? "bg-carbon text-white" : "text-carbon/70 hover:bg-bone"}`}>
            {modo === "MES" ? "Mes" : "Semana"}
          </button>)}
        </div>
      </div>
    </form><p className="mt-4 text-xs text-carbon/55">Período aplicado: {fecha(seleccion.desde)} al {fecha(seleccion.hasta)}. Las semanas empiezan el lunes.</p></Card>

    {errorExportacion && <div className="mb-5"><InfoBox tipo="error">{errorExportacion}</InfoBox></div>}
    {error && <InfoBox tipo="error">{error}</InfoBox>}
    <div aria-busy={cargando}>
      {cargando && <p role="status" className="py-14 text-center text-sm text-carbon/60">Cargando egresos…</p>}
      {reporte && <div className="space-y-6">
        {reporte.total === 0 && <InfoBox>No hay egresos confirmados en el período seleccionado.</InfoBox>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card><p className="text-xs uppercase text-carbon/50">Egreso acumulado del período</p><p className="mt-3 text-2xl font-semibold tabular-nums">{moneda(reporte.total)}</p><p className="mt-2 text-xs text-carbon/50">{reporte.movimientos.length} movimientos · Pesos argentinos</p></Card>
          <Card><p className="text-xs uppercase text-carbon/50">Categoría de mayor peso</p><p className="mt-3 text-xl font-semibold">{reporte.categoria_principal?.nombre ?? "Sin egresos"}</p><p className="mt-2 text-xs text-carbon/50">{reporte.categoria_principal ? `${moneda(reporte.categoria_principal.importe)} · ${reporte.categoria_principal.porcentaje.toLocaleString("es-AR", { maximumFractionDigits: 2 })}% del período` : "No hay importes para comparar"}</p></Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {reporte.categorias.map(categoria => <Card key={categoria.id}>
            <div className="flex items-baseline justify-between gap-2"><p className="text-sm text-carbon/65">{categoria.nombre}</p><p className="text-lg font-semibold tabular-nums">{moneda(categoria.importe)}</p></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-bone-dark"><div className="h-full rounded-full" style={{ width: `${reporte.total ? categoria.importe / reporte.total * 100 : 0}%`, backgroundColor: COLORES[categoria.id] }} /></div>
          </Card>)}
        </div>

        <Card titulo="Resumen por período" descripcion={`Egresos por ${reporte.agrupacion === "MES" ? "mes" : "semana"}, con acumulado dentro del rango seleccionado.`}>
          <Table><THead><TH>Período</TH>{reporte.categorias.map(categoria => <TH key={categoria.id} className="text-right">{categoria.nombre}</TH>)}<TH className="text-right">Total</TH><TH className="text-right">Acumulado</TH></THead><TBody>
            {reporte.serie.map(periodo => <TR key={periodo.inicio}>
              <TD className="whitespace-nowrap text-xs">{fecha(periodo.desde)}<br />al {fecha(periodo.hasta)}</TD>
              {reporte.categorias.map(categoria => <TD key={categoria.id} className="whitespace-nowrap text-right tabular-nums">{moneda(periodo.categorias[categoria.id])}</TD>)}
              <TD className="whitespace-nowrap text-right font-medium tabular-nums">{moneda(periodo.total)}</TD>
              <TD className="whitespace-nowrap text-right tabular-nums text-carbon/60">{moneda(periodo.acumulado)}</TD>
            </TR>)}
          </TBody></Table>
        </Card>
        <DetalleEgresos reporte={reporte} key={consulta} />
        <p className="text-xs leading-relaxed text-carbon/55">Se cuentan los importes aplicados a órdenes de pago confirmadas, por su fecha de confirmación en Argentina. Las compras de stock y los gastos vinculados clasifican esos pagos; no se agregan como movimientos aparte.</p>
      </div>}
    </div>
  </>;
}