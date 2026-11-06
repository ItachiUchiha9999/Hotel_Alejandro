"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Download, PieChart, TrendingUp } from "lucide-react";
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
      <Table className="table-fixed w-full"><THead><TH style={{ width: '15%' }}>Fecha</TH><TH style={{ width: '20%' }}>Categoría</TH><TH style={{ width: '25%' }}>Proveedor</TH><TH style={{ width: '25%' }}>Comprobante</TH><TH className="text-right" style={{ width: '15%' }}>Importe</TH></THead><TBody>
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
  const [animar, setAnimar] = useState(false);

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

  // Trigger animation on mount/data change
  useEffect(() => {
    setAnimar(false);
    requestAnimationFrame(() => setAnimar(true));
  }, [reporte.serie.length, reporte.agrupacion]);

  return <Card titulo="Gráfico de egresos" descripcion={`Importes por ${reporte.agrupacion === "MES" ? "mes" : "semana"} y categoría. Desplazate horizontalmente para ver todo el período.`} className="animate-slide-up-slow">
    {!reporte.serie.length ? <p className="py-5 text-sm text-carbon/60">No hay períodos para graficar.</p> : <>
      {reporte.total === 0 && <p className="mb-4 text-sm text-carbon/60">No hay egresos registrados en este período. El gráfico muestra los períodos con valor cero.</p>}
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2" aria-label="Categorías">
        {categorias.map((categoria, idx) => (
          <span key={categoria.id} className={`stagger-${(idx % 8) + 1} animate-slide-in inline-flex items-center gap-2 text-xs text-carbon/70`}>
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORES[categoria.id] }} />{categoria.nombre}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto pb-2">
        <svg role="img" aria-label={`Gráfico de egresos de ${fecha(reporte.desde)} a ${fecha(reporte.hasta)}, total ${moneda(reporte.total)}`} viewBox={`0 0 ${ancho} ${alto}`} width={ancho} height={alto} className="max-w-none">
          {[0, 0.5, 1].map((fraccion, idx) => {
            const y = arriba + altoGrafico * (1 - fraccion);
            return (
              <g key={fraccion} className={`animate-fade-in stagger-${idx + 1}`}>
                <line x1="34" x2={ancho - 8} y1={y} y2={y} stroke="#e6e0d6" strokeDasharray={fraccion === 0 ? undefined : "3 5"} />
                <text x="29" y={y + 4} textAnchor="end" fill="#77736d" fontSize="10">{etiquetaEje(maximo * fraccion)}</text>
              </g>
            );
          })}
          {reporte.serie.map((periodo, indice) => {
            const x = 42 + indice * paso;
            let yBase = arriba + altoGrafico;
            const etiqueta = new Date(`${periodo.desde}T12:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
            const delay = (indice % 8) * 60;

            if (periodo.total === 0) return (
              <g key={periodo.inicio} style={{ animationDelay: `${delay}ms` }} className="animate-slide-up-slow">
                <rect x={x} y={arriba + altoGrafico - 2} width={anchoBarra} height={2} fill="#a9a39a"><title>{`${etiqueta} · Sin egresos`}</title></rect>
                {(indice % intervaloEtiqueta === 0 || indice === reporte.serie.length - 1) && (
                  <text x={x + anchoBarra / 2} y={alto - 20} textAnchor="middle" fill="#77736d" fontSize="10" className="animate-fade-in">{etiqueta}</text>
                )}
              </g>
            );

            return (
              <g key={periodo.inicio} style={{ animationDelay: `${delay}ms` }} className="animate-slide-up-slow">
                {reporte.categorias.map((categoria, catIdx) => {
                  const valor = periodo.categorias[categoria.id] || 0;
                  const altura = valor / maximo * altoGrafico;
                  if (!altura) return null;
                  yBase -= altura;
                  return (
                    <rect
                      key={categoria.id}
                      x={x}
                      y={animar ? yBase : arriba + altoGrafico}
                      width={anchoBarra}
                      height={animar ? altura : 0}
                      fill={COLORES[categoria.id]}
                      className={`stagger-${(catIdx % 8) + 1} animate-scale-in`}
                      style={{
                        transformOrigin: `${x + anchoBarra / 2}px ${arriba + altoGrafico}px`,
                        transition: "y 0.6s cubic-bezier(0.4, 0, 0.2, 1), height 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                        transitionDelay: `${catIdx * 40}ms`,
                      }}
                    >
                      <title>{`${etiqueta} · ${categoria.nombre}: ${moneda(valor)}`}</title>
                    </rect>
                  );
                })}
                {periodo.total > 0 && <title>{`${etiqueta} · Total: ${moneda(periodo.total)}`}</title>}
                {(indice % intervaloEtiqueta === 0 || indice === reporte.serie.length - 1) && (
                  <text x={x + anchoBarra / 2} y={alto - 20} textAnchor="middle" fill="#77736d" fontSize="10" className="animate-fade-in stagger-8">{etiqueta}</text>
                )}
              </g>
            );
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
  const consulta = new URLSearchParams(seleccion).toString();
  const vigente = resultado?.consulta === consulta;
  const reporte = vigente ? resultado.reporte : undefined;
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
    if (!reporte) return;
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

        {/* Distribución por categoría - Donut chart */}
        <Card titulo="Distribución por categoría" descripcion="Participación de cada categoría de egreso en el total del período." className="animate-slide-up-slow">
          <DonutChartEgresos reporte={reporte} />
        </Card>

        {/* Tendencia por categoría - Line chart */}
        <Card titulo="Tendencia por categoría" descripcion={`Evolución de cada categoría de egreso por ${reporte.agrupacion === "MES" ? "mes" : "semana"}.`} className="animate-slide-up-slow">
          <LineaTendenciaEgresos reporte={reporte} />
        </Card>

        <GraficoEgresos reporte={reporte} />

        <Card titulo="Resumen por período" descripcion={`Egresos por ${reporte.agrupacion === "MES" ? "mes" : "semana"}, con acumulado dentro del rango seleccionado.`}>
          <Table className="table-fixed w-full"><THead><TH style={{ width: '15%' }}>Período</TH>{reporte.categorias.map(categoria => <TH key={categoria.id} className="text-right" style={{ width: '18%' }}>{categoria.nombre}</TH>)}<TH className="text-right" style={{ width: '15%' }}>Total</TH><TH className="text-right" style={{ width: '15%' }}>Acumulado</TH></THead><TBody>
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

/* Donut chart for expense distribution by category */
function DonutChartEgresos({ reporte }: { reporte: ReporteEgresos }) {
  const [animar, setAnimar] = useState(false);
  useEffect(() => { setAnimar(false); requestAnimationFrame(() => setAnimar(true)); }, [reporte.total]);

  const radio = 80;
  const grosor = 18;
  const circunferencia = 2 * Math.PI * radio;
  const categoriasConImporte = reporte.categorias.filter(c => c.importe > 0);
  let acumulado = 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-[220px]">
      <svg viewBox={`0 0 ${radio * 2} ${radio * 2}`} width="180" height="180" role="img" aria-label="Distribución de egresos por categoría">
        {categoriasConImporte.map((c, idx) => {
          const porcentaje = reporte.total ? (c.importe / reporte.total) : 0;
          const dashArray = `${porcentaje * circunferencia} ${circunferencia}`;
          const dashOffset = -acumulado / reporte.total * circunferencia;
          const startAngle = (acumulado / reporte.total) * 2 * Math.PI - Math.PI / 2;
          acumulado += c.importe;
          return (
            <circle
              key={c.id}
              cx={radio} cy={radio} r={radio - grosor / 2}
              fill="none" stroke={COLORES[c.id]}
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
              <title>{c.nombre}: {moneda(c.importe)} ({(porcentaje * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%)</title>
            </circle>
          );
        })}
        {reporte.total === 0 && (
          <circle cx={radio} cy={radio} r={radio - grosor / 2} fill="none" stroke="#e6e0d6" strokeWidth={grosor} />
        )}
      </svg>
      <p className="mt-4 text-center text-sm font-medium text-carbon">{moneda(reporte.total)}</p>
      <p className="text-xs text-carbon/50">Total del período</p>
    </div>
  );
}

/* Line chart showing trend by category over time */
function LineaTendenciaEgresos({ reporte }: { reporte: ReporteEgresos }) {
  const [animar, setAnimar] = useState(false);
  useEffect(() => { setAnimar(false); requestAnimationFrame(() => setAnimar(true)); }, [reporte.serie.length, reporte.agrupacion]);

  const ancho = Math.max(760, reporte.serie.length * 62 + 80);
  const alto = 250;
  const x0 = 60;
  const x1 = ancho - 25;
  const y0 = 200;
  const altura = 160;
  const maximo = Math.max(1, ...reporte.serie.map(p => p.total), ...reporte.categorias.flatMap(c => reporte.serie.map(p => p.categorias[c.id])));
  const x = (i: number) => reporte.serie.length <= 1 ? (x0 + x1) / 2 : x0 + i / (reporte.serie.length - 1) * (x1 - x0);
  const y = (valor: number) => y0 - valor / maximo * altura;
  const trazado = (catId: CategoriaId) => reporte.serie.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.categorias[catId] || 0)}`).join(" ");
  const compacto = (valor: number) => new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(valor);
  const etiqueta = (valor: string) => reporte.agrupacion === "MES" ? new Date(`${valor}T12:00:00Z`).toLocaleDateString("es-AR", { month: "short", year: "2-digit", timeZone: "UTC" }) : `${valor.slice(8, 10)}/${valor.slice(5, 7)}`;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-carbon/70" aria-label="Categorías">
        {reporte.categorias.map((c, idx) => (
          <span key={c.id} className={`stagger-${idx + 1} animate-slide-in inline-flex items-center gap-2`}>
            <span className="h-1 w-5 rounded" style={{ backgroundColor: COLORES[c.id] }} />{c.nombre}
          </span>
        ))}
      </div>
      <svg width={ancho} viewBox={`0 0 ${ancho} ${alto}`} className="max-w-none" role="img" aria-label="Gráfico de líneas de egresos por categoría y período">
        <title>Evolución de egresos por categoría: proveedores, compras de stock, gastos operativos</title>
        {[0, 0.25, 0.5, 0.75, 1].map(fraccion => (
          <g key={fraccion} className="animate-fade-in stagger-1">
            <line x1={x0} x2={x1} y1={y(maximo * fraccion)} y2={y(maximo * fraccion)} stroke="#e8e0d4" strokeDasharray="4 5" />
            <text x={x0 - 8} y={y(maximo * fraccion) + 4} textAnchor="end" fontSize="10" fill="#756f67">{compacto(maximo * fraccion)}</text>
          </g>
        ))}
        {reporte.categorias.map((c, catIdx) => {
          const pathData = trazado(c.id);
          return (
            <path
              key={c.id}
              d={pathData}
              fill="none"
              stroke={COLORES[c.id]}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              className={`stagger-${(catIdx % 6) + 2} animate-fade-in`}
              style={{
                opacity: animar ? 1 : 0,
                transition: "opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                transitionDelay: `${catIdx * 150}ms`,
              }}
            />
          );
        })}
        {reporte.serie.map((p, i) => {
          const intervaloEtiqueta = Math.max(1, Math.ceil(reporte.serie.length / 10));
          return (
            <g key={p.inicio} className="animate-fade-in stagger-3" style={{ animationDelay: `${(i % 8) * 80}ms` }}>
              {(i % intervaloEtiqueta === 0 || i === reporte.serie.length - 1) && (
                <text x={x(i)} y={y0 + 22} textAnchor="middle" fontSize={10} fill="#756f67">{etiqueta(p.inicio)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-right text-xs text-carbon/55">Escala vertical: pesos argentinos</p>
    </div>
  );
}
