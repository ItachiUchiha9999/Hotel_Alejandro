"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Card, Field, InfoBox, Input, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { api, authHeaders, urlDescarga } from "@/lib/api";

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
  COMPRAS_STOCK: "#b08d48",
  GASTOS_OPERATIVOS: "#b3453c",
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

function crearReporteDemo(reporte: ReporteEgresos): ReporteEgresos {
  const importes: Record<CategoriaId, number> = { PROVEEDORES: 0, COMPRAS_STOCK: 0, GASTOS_OPERATIVOS: 0 };
  const movimientos: Movimiento[] = [];
  const serie = reporte.serie.map((periodo, indice) => {
    const categorias: Record<CategoriaId, number> = {
      PROVEEDORES: 185000 + (indice % 5) * 17000,
      COMPRAS_STOCK: 76000 + (indice % 4) * 11500,
      GASTOS_OPERATIVOS: 42000 + (indice % 3) * 8500,
    };
    const ejemplos: Array<{ categoria: CategoriaId; proveedor: string; detalle: string }> = [
      { categoria: "PROVEEDORES", proveedor: "Distribuidora Ejemplo (FICTICIO)", detalle: "Factura demostrativa de insumos" },
      { categoria: "COMPRAS_STOCK", proveedor: "Mayorista Demo (FICTICIO)", detalle: "Comprobante demostrativo de stock" },
      { categoria: "GASTOS_OPERATIVOS", proveedor: "Servicios Demo (FICTICIO)", detalle: "Comprobante demostrativo de servicio" },
    ];
    ejemplos.forEach((ejemplo, posicion) => {
      const importe = categorias[ejemplo.categoria];
      importes[ejemplo.categoria] += importe;
      movimientos.push({
        id: `DEMO-${periodo.inicio}-${posicion}`,
        fecha: periodo.desde,
        categoria: ejemplo.categoria,
        detalle: ejemplo.detalle,
        proveedor: ejemplo.proveedor,
        payment_order_id: 900000 + indice * 10 + posicion,
        importe,
      });
    });
    return { ...periodo, categorias, total: Object.values(categorias).reduce((suma, importe) => suma + importe, 0), acumulado: 0 };
  });
  let acumulado = 0;
  serie.forEach(periodo => { acumulado += periodo.total; periodo.acumulado = acumulado; });
  const total = Object.values(importes).reduce((suma, importe) => suma + importe, 0);
  const categorias: Categoria[] = reporte.categorias.map(categoria => ({ ...categoria, importe: importes[categoria.id] }));
  const principal = [...categorias].sort((a, b) => b.importe - a.importe)[0];
  return {
    ...reporte,
    total,
    categorias,
    categoria_principal: principal ? { ...principal, porcentaje: principal.importe / total * 100 } : null,
    serie,
    movimientos,
  };
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

function GraficoEgresos({ reporte }: { reporte: ReporteEgresos }) {
  const anchoBarra = 54;
  const espacio = 22;
  const ancho = Math.max(760, reporte.serie.length * (anchoBarra + espacio) + 40);
  const alto = 230;
  const arriba = 12;
  const altoGrafico = 170;
  const maximo = Math.max(1, ...reporte.serie.map(periodo => periodo.total));
  const etiquetaEje = (valor: number) => valor >= 1_000_000
    ? `${(valor / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`
    : valor >= 1_000
      ? `${(valor / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} k`
      : Math.round(valor).toLocaleString("es-AR");
  const paso = anchoBarra + espacio;
  const intervaloEtiqueta = Math.max(1, Math.ceil(reporte.serie.length / 10));
  const categorias = reporte.categorias;

  return <Card titulo="Gráfico de egresos" descripcion={`Importes por ${reporte.agrupacion === "MES" ? "mes" : "semana"} y categoría. Desplazate horizontalmente para ver todo el período.`}>
    {!reporte.serie.length ? <p className="py-5 text-sm text-carbon/60">No hay períodos para graficar.</p> : <>
      {reporte.total === 0 && <p className="mb-4 text-sm text-carbon/60">No hay egresos registrados en este período. El gráfico muestra los períodos con valor cero.</p>}
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2" aria-label="Categorías">
        {categorias.map(categoria => <span key={categoria.id} className="inline-flex items-center gap-2 text-xs text-carbon/70"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORES[categoria.id] }} />{categoria.nombre}</span>)}
      </div>
      <div className="overflow-x-auto pb-2">
        <svg role="img" aria-label={`Gráfico de egresos de ${fecha(reporte.desde)} a ${fecha(reporte.hasta)}, total ${moneda(reporte.total)}`} viewBox={`0 0 ${ancho} ${alto}`} width={ancho} height={alto} className="max-w-none">
          {[0, 0.5, 1].map(fraccion => {
            const y = arriba + altoGrafico * (1 - fraccion);
            return <g key={fraccion}>
              <line x1="34" x2={ancho - 8} y1={y} y2={y} stroke="#e6e0d6" strokeDasharray={fraccion === 0 ? undefined : "3 5"} />
              <text x="29" y={y + 4} textAnchor="end" fill="#77736d" fontSize="10">${etiquetaEje(maximo * fraccion)}</text>
            </g>;
          })}
          {reporte.serie.map((periodo, indice) => {
            const x = 42 + indice * paso;
            let yBase = arriba + altoGrafico;
            const etiqueta = new Date(`${periodo.desde}T12:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
            if (periodo.total === 0) return <g key={periodo.inicio}>
              <rect x={x} y={arriba + altoGrafico - 2} width={anchoBarra} height={2} fill="#a9a39a"><title>{`${etiqueta} · Sin egresos`}</title></rect>
              {(indice % intervaloEtiqueta === 0 || indice === reporte.serie.length - 1) && <text x={x + anchoBarra / 2} y={alto - 20} textAnchor="middle" fill="#77736d" fontSize="10">{etiqueta}</text>}
            </g>;
            return <g key={periodo.inicio}>
              {reporte.categorias.map(categoria => {
                const valor = periodo.categorias[categoria.id] || 0;
                const altura = valor / maximo * altoGrafico;
                if (!altura) return null;
                yBase -= altura;
                return <rect key={categoria.id} x={x} y={yBase} width={anchoBarra} height={altura} fill={COLORES[categoria.id]}>
                  <title>{`${etiqueta} · ${categoria.nombre}: ${moneda(valor)}`}</title>
                </rect>;
              })}
              {periodo.total > 0 && <title>{`${etiqueta} · Total: ${moneda(periodo.total)}`}</title>}
              {(indice % intervaloEtiqueta === 0 || indice === reporte.serie.length - 1) && <text x={x + anchoBarra / 2} y={alto - 20} textAnchor="middle" fill="#77736d" fontSize="10">{etiqueta}</text>}
            </g>;
          })}
        </svg>
      </div>
      <p className="mt-2 text-right text-xs text-carbon/55">Escala vertical: pesos argentinos · Total del período: {moneda(reporte.total)}</p>
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
  const [mostrarDemo, setMostrarDemo] = useState(false);
  const consulta = new URLSearchParams(seleccion).toString();
  const vigente = resultado?.consulta === consulta;
  const reporteReal = vigente ? resultado.reporte : undefined;
  const reporte = reporteReal && mostrarDemo ? crearReporteDemo(reporteReal) : reporteReal;
  const error = vigente ? resultado.error : undefined;
  const cargando = !vigente;
  const cantidadesPorCategoria = reporte?.movimientos.reduce<Partial<Record<CategoriaId, number>>>((acumulado, movimiento) => {
    acumulado[movimiento.categoria] = (acumulado[movimiento.categoria] ?? 0) + 1;
    return acumulado;
  }, {}) ?? {};
  const promedioPorMovimiento = reporte?.movimientos.length ? reporte.total / reporte.movimientos.length : 0;

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
    if (!reporte || mostrarDemo) return;
    setExportando(formato);
    setErrorExportacion(null);
    try {
      const parametros = new URLSearchParams({ desde: reporte.desde, hasta: reporte.hasta, agrupacion: reporte.agrupacion, formato });
      const respuesta = await fetch(urlDescarga(`/egresos/exportar?${parametros}`), { headers: authHeaders() });
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
        <Button variante="secundario" disabled={!montado || !reporte || mostrarDemo || exportando !== null} cargando={exportando === "pdf"} onClick={() => exportar("pdf")}><Download size={15} />PDF</Button>
        <Button variante="secundario" disabled={!montado || !reporte || mostrarDemo || exportando !== null} cargando={exportando === "xlsx"} onClick={() => exportar("xlsx")}><Download size={15} />Excel</Button>
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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3">
          <p className="text-sm text-carbon/65">{mostrarDemo ? "Vista de demostración: los movimientos son ficticios y no se guardan." : "¿Querés previsualizar el reporte con movimientos de ejemplo?"}</p>
          <Button variante="secundario" tamano="sm" onClick={() => setMostrarDemo(actual => !actual)}>{mostrarDemo ? "Volver a datos reales" : "Mostrar ejemplo ficticio"}</Button>
        </div>
        {mostrarDemo && <InfoBox>Datos ficticios de demostración. No corresponden a pagos reales y no se incluyen en las exportaciones.</InfoBox>}
        {reporte.total === 0 && <InfoBox>No hay egresos confirmados en el período seleccionado.</InfoBox>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><p className="text-xs uppercase text-carbon/50">Egreso acumulado del período</p><p className="mt-3 text-2xl font-semibold tabular-nums">{moneda(reporte.total)}</p><p className="mt-2 text-xs text-carbon/50">{reporte.movimientos.length} movimientos · Pesos argentinos</p></Card>
          <Card><p className="text-xs uppercase text-carbon/50">Promedio por egreso</p><p className="mt-3 text-2xl font-semibold tabular-nums">{moneda(promedioPorMovimiento)}</p><p className="mt-2 text-xs text-carbon/50">Importe medio por movimiento registrado</p></Card>
          <Card><p className="text-xs uppercase text-carbon/50">Categoría de mayor peso</p><p className="mt-3 text-xl font-semibold">{reporte.categoria_principal?.nombre ?? "Sin egresos"}</p><p className="mt-2 text-xs text-carbon/50">{reporte.categoria_principal ? `${moneda(reporte.categoria_principal.importe)} · ${reporte.categoria_principal.porcentaje.toLocaleString("es-AR", { maximumFractionDigits: 2 })}% del período` : "No hay importes para comparar"}</p></Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {reporte.categorias.map(categoria => {
            const cantidad = cantidadesPorCategoria[categoria.id] ?? 0;
            const participacion = reporte.total ? categoria.importe / reporte.total * 100 : 0;
            return <Card key={categoria.id}>
              <div className="flex items-start justify-between gap-2"><p className="text-sm text-carbon/65">{categoria.nombre}</p><span className="text-xs tabular-nums text-carbon/55">{participacion.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%</span></div>
              <p className="mt-2 text-lg font-semibold tabular-nums" style={{ color: COLORES[categoria.id] }}>{moneda(categoria.importe)}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-bone-dark"><div className="h-full rounded-full" style={{ width: `${participacion}%`, backgroundColor: COLORES[categoria.id] }} /></div>
              <p className="mt-2 text-xs text-carbon/55">{cantidad} {cantidad === 1 ? "movimiento" : "movimientos"} · Promedio {moneda(cantidad ? categoria.importe / cantidad : 0)}</p>
            </Card>;
          })}
        </div>

        <GraficoEgresos reporte={reporte} />

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
