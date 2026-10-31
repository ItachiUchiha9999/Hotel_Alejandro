"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Calendar,
  DollarSign,
  BedDouble,
  Percent,
  Filter,
  BarChart2,
  LineChart,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  InfoBox,
  Input,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
} from "@/components/ui";
import { SkeletonTable, SkeletonKPI } from "@/components/ui/Skeleton";
import {
  api,
  getReporteOcupacionTemporadas,
  type ReporteOcupacionTemporadas,
} from "@/lib/api";

interface TipoHabitacionSimple {
  room_type_id: number;
  room_type_name: string;
}

const TEMPORADAS = ["TODAS", "GENERAL", "ALTA", "BAJA", "ESPECIAL"] as const;

function formatearMoneda(val: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(val || 0);
}

export default function ReporteTemporadasPage() {
  const hoy = new Date().toISOString().slice(0, 10);
  const inicioMes = `${hoy.slice(0, 7)}-01`;

  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(hoy);
  const [temporada, setTemporada] = useState<string>("TODAS");
  const [tipoSeleccionado, setTipoSeleccionado] = useState<string>("TODOS");

  const [tiposDisponibles, setTiposDisponibles] = useState<TipoHabitacionSimple[]>([]);
  const [reporte, setReporte] = useState<ReporteOcupacionTemporadas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar lista de tipos de habitación para el filtro
  useEffect(() => {
    api.get<TipoHabitacionSimple[]>("/tipos-habitacion")
      .then((data: TipoHabitacionSimple[]) => setTiposDisponibles(data))
      .catch(() => {
        // Fallback a panel si no responde tipos
        api.get<TipoHabitacionSimple[]>("/panel-habitaciones")
          .then((data: TipoHabitacionSimple[]) => setTiposDisponibles(data))
          .catch(() => {});
      });
  }, []);

  const ejecutarConsulta = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const data = await getReporteOcupacionTemporadas({
        desde,
        hasta,
        temporada,
        tipo: tipoSeleccionado,
      });
      setReporte(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo cargar el reporte.";
      setError(msg);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    ejecutarConsulta();
  }, []);

  return (
    <div className="flex min-h-full w-full flex-col">
      <PageHeader
        eyebrow="REP-08"
        titulo="Ocupación e Ingresos por Temporada"
        descripcion="Análisis del desempeño comercial, noches ocupadas, tarifa promedio (ADR) y facturación por tipo de habitación."
      />

      {error && (
        <div className="mt-4">
          <InfoBox tipo="error">{error}</InfoBox>
        </div>
      )}

      {/* Barra de Filtros */}
      <Card className="mt-6">
        <form onSubmit={ejecutarConsulta} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
          <Field label="Desde" htmlFor="filtro-desde">
            <Input
              id="filtro-desde"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </Field>

          <Field label="Hasta" htmlFor="filtro-hasta">
            <Input
              id="filtro-hasta"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </Field>

          <Field label="Temporada" htmlFor="filtro-temporada">
            <Select
              id="filtro-temporada"
              value={temporada}
              onChange={(e) => setTemporada(e.target.value)}
            >
              {TEMPORADAS.map((t) => (
                <option key={t} value={t}>
                  {t === "TODAS" ? "Todas las temporadas" : t}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Tipo de habitación" htmlFor="filtro-tipo">
            <Select
              id="filtro-tipo"
              value={tipoSeleccionado}
              onChange={(e) => setTipoSeleccionado(e.target.value)}
            >
              <option value="TODOS">Todos los tipos</option>
              {tiposDisponibles.map((t) => (
                <option key={t.room_type_id} value={t.room_type_id}>
                  {t.room_type_name}
                </option>
              ))}
            </Select>
          </Field>

          <Button type="submit" cargando={cargando} className="w-full">
            <Filter size={16} className="mr-1.5" />
            Filtrar
          </Button>
        </form>
      </Card>

      {/* Métricas / KPIs Clave */}
      {cargando ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SkeletonKPI />
          <SkeletonKPI />
          <SkeletonKPI />
          <SkeletonKPI />
        </div>
      ) : reporte && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="stagger-1 animate-slide-up-slow rounded-xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase font-medium text-carbon/60">Tasa de ocupación</p>
                <p className="mt-2 text-2xl font-bold text-carbon">
                  {reporte.resumen.tasa_ocupacion_global_pct}%
                </p>
                <p className="mt-1 text-xs text-carbon/50">
                  {reporte.resumen.noches_ocupadas} / {reporte.resumen.capacidad_total_noches} noches
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold/15 text-carbon">
                <Percent size={21} />
              </div>
            </div>
          </div>

          <div className="stagger-2 animate-slide-up-slow rounded-xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase font-medium text-carbon/60">Ingresos alojamiento</p>
                <p className="mt-2 text-2xl font-bold text-carbon">
                  {formatearMoneda(reporte.resumen.ingresos_totales_alojamiento)}
                </p>
                <p className="mt-1 text-xs text-carbon/50">Facturación bruta del período</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold/15 text-carbon">
                <DollarSign size={21} />
              </div>
            </div>
          </div>

          <div className="stagger-3 animate-slide-up-slow rounded-xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase font-medium text-carbon/60">Tarifa promedio (ADR)</p>
                <p className="mt-2 text-2xl font-bold text-carbon">
                  {formatearMoneda(reporte.resumen.adr_global)}
                </p>
                <p className="mt-1 text-xs text-carbon/50">Ingreso por noche vendida</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold/15 text-carbon">
                <BedDouble size={21} />
              </div>
            </div>
          </div>

          <div className="stagger-4 animate-slide-up-slow rounded-xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase font-medium text-carbon/60">RevPAR</p>
                <p className="mt-2 text-2xl font-bold text-carbon">
                  {formatearMoneda(reporte.resumen.revpar)}
                </p>
                <p className="mt-1 text-xs text-carbon/50">Ingreso por noche disponible</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold/15 text-carbon">
                <Calendar size={21} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ocupación por temporada y tipo - Grouped bar chart */}
      {reporte && (
        <Card titulo="Ocupación por temporada y tipo" descripcion="Tasa de ocupación comparada entre tipos de habitación y temporadas." className="animate-slide-up-slow mt-6">
          <BarrasOcupacionTemporadas reporte={reporte} />
        </Card>
      )}

      {/* Tendencia ADR y RevPAR - Line chart */}
      {reporte && reporte.desglose.length > 0 && (
        <Card titulo="Tendencia ADR y RevPAR" descripcion="Evolución de la tarifa promedio y RevPAR por temporada." className="animate-slide-up-slow mt-6">
          <LineaADRRevPARTemporadas reporte={reporte} />
        </Card>
      )}

      {/* Tabla Desglosada */}
      <Card className="mt-6" titulo="Desglose por Temporada y Tipo de Habitación">
        {cargando ? (
          <SkeletonTable rows={6} columns={7} />
        ) : !reporte || reporte.desglose.length === 0 ? (
          <EmptyState
            titulo="Sin actividad en el período seleccionado"
            descripcion="No se registraron noches de alojamiento en las fechas especificadas. Probá ampliando el rango de búsqueda."
          />
        ) : (
          <Table className="w-full table-fixed">
            <THead>
              <TH className="w-[20%] bg-carbon/5 text-xs uppercase text-carbon/60">Tipo</TH>
              <TH className="w-[15%] bg-carbon/5 text-xs uppercase text-carbon/60">Temporada</TH>
              <TH className="w-[12%] bg-carbon/5 text-center text-xs uppercase text-carbon/60">Reservas</TH>
              <TH className="w-[15%] bg-carbon/5 text-center text-xs uppercase text-carbon/60">Noches (Ocup / Disp)</TH>
              <TH className="w-[12%] bg-carbon/5 text-center text-xs uppercase text-carbon/60">Ocupación %</TH>
              <TH className="w-[13%] bg-carbon/5 text-right text-xs uppercase text-carbon/60">ADR</TH>
              <TH className="w-[13%] bg-carbon/5 text-right text-xs uppercase text-carbon/60">Ingresos</TH>
            </THead>
            <TBody>
              {reporte.desglose.map((fila, idx) => (
                <tr key={`${fila.room_type_id}-${fila.season_name}-${idx}`} className={`stagger-${(idx % 8) + 1} animate-slide-up-slow border-b border-line hover:bg-bone/40`}>
                  <TD className="font-medium text-carbon">{fila.room_type_name}</TD>
                  <TD>
                    <Badge
                      tono={
                        (fila.season_name === "ALTA"
                            ? "advertencia"
                            : fila.season_name === "ESPECIAL"
                            ? "inactivo"
                            : "activo") as any
                      }
                    >
                      {fila.season_name}
                    </Badge>
                  </TD>
                  <TD className="text-center font-medium">{fila.total_reservas}</TD>
                  <TD className="text-center text-xs">
                    <span className="font-semibold text-carbon">{fila.noches_ocupadas}</span>
                    <span className="text-carbon/40"> / {fila.noches_disponibles}</span>
                  </TD>
                  <TD className="text-center font-semibold text-carbon">
                    {fila.tasa_ocupacion_pct}%
                  </TD>
                  <TD className="text-right text-xs font-medium text-carbon">
                    {formatearMoneda(fila.adr)}
                  </TD>
                  <TD className="text-right font-bold text-carbon">
                    {formatearMoneda(fila.ingresos_alojamiento)}
                  </TD>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* Grouped bar chart for occupancy by season and room type */
function BarrasOcupacionTemporadas({ reporte }: { reporte: ReporteOcupacionTemporadas }) {
  const [animar, setAnimar] = useState(false);
  useEffect(() => { setAnimar(false); requestAnimationFrame(() => setAnimar(true)); }, [reporte.desglose.length]);

  // Get unique seasons and room types
  const temporadas = [...new Set(reporte.desglose.map(d => d.season_name))].sort();
  const tipos = [...new Set(reporte.desglose.map(d => d.room_type_name))];

  const coloresTemporadas: Record<string, string> = {
    ALTA: "#ef6c00",
    BAJA: "#2e7d32",
    GENERAL: "#1565c0",
    ESPECIAL: "#6a1b9a",
  };

  const maximo = Math.max(1, ...reporte.desglose.map(d => d.tasa_ocupacion_pct));
  const anchoBarra = Math.max(20, Math.min(35, 760 / Math.max(1, tipos.length * temporadas.length) - 8));
  const espacioTemporada = 6;
  const espacioTipo = 20;
  const anchoGrupo = temporadas.length * anchoBarra + (temporadas.length - 1) * espacioTemporada;
  const ancho = Math.max(700, tipos.length * (anchoGrupo + espacioTipo) + 80);
  const alto = 250;
  const arriba = 25;
  const altoGrafico = 180;
  const y = (valor: number) => arriba + altoGrafico - (valor / 100) * altoGrafico;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${ancho} ${alto}`} width={ancho} height={alto} className="max-w-none" role="img" aria-label="Ocupación por temporada y tipo de habitación">
        {/* Grid lines (0%, 25%, 50%, 75%, 100%) */}
        {[0, 0.25, 0.5, 0.75, 1].map(fraccion => (
          <g key={fraccion} className="animate-fade-in stagger-1">
            <line x1="60" x2={ancho - 10} y1={y(fraccion * 100)} y2={y(fraccion * 100)} stroke="#e8e0d4" strokeDasharray="4 5" />
            <text x="55" y={y(fraccion * 100) + 4} textAnchor="end" fontSize="10" fill="#756f67">{Math.round(fraccion * 100)}%</text>
          </g>
        ))}
        {/* Bars */}
        {tipos.map((tipo, tIdx) => {
          const xBase = 70 + tIdx * (anchoGrupo + espacioTipo);
          return (
            <g key={tipo} style={{ animationDelay: `${(tIdx % 8) * 80}ms` }} className="animate-slide-up-slow">
              {temporadas.map((temporada, sIdx) => {
                const fila = reporte.desglose.find(d => d.room_type_name === tipo && d.season_name === temporada);
                const valor = fila?.tasa_ocupacion_pct ?? 0;
                const x = xBase + sIdx * (anchoBarra + espacioTemporada);
                return (
                  <rect
                    key={temporada}
                    x={x} y={animar ? y(valor) : arriba + altoGrafico}
                    width={anchoBarra} height={animar ? (arriba + altoGrafico - y(valor)) : 0}
                    fill={coloresTemporadas[temporada] ?? "#b08d48"} rx={3}
                    className={`stagger-${(sIdx % 6) + 1} animate-scale-in`}
                    style={{
                      transformOrigin: `${x + anchoBarra / 2}px ${arriba + altoGrafico}px`,
                      transition: "y 0.6s cubic-bezier(0.4, 0, 0.2, 1), height 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                      transitionDelay: `${sIdx * 40}ms`,
                    }}
                  >
                    <title>{tipo} - {temporada}: {valor}% ocupación</title>
                  </rect>
                );
              })}
              {/* Tipo label */}
              <text x={xBase + anchoGrupo / 2} y={alto - 8} textAnchor="middle" fontSize="10" fill="#756f67" className="animate-fade-in stagger-5">{tipo.slice(0, 12)}</text>
            </g>
          );
        })}
        {/* Legend */}
        <g className="animate-fade-in stagger-1" transform={`translate(${ancho / 2 - 120}, ${alto - 5})`}>
          {temporadas.map((temporada, i) => (
            <g key={temporada} transform={`translate(${i * 90}, 0)`}>
              <rect x={0} y={0} width={12} height={12} rx={2} fill={coloresTemporadas[temporada] ?? "#b08d48"} />
              <text x={16} y={10} fontSize="11" fill="#756f67">{temporada}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

/* Line chart for ADR and RevPAR trends by season */
function LineaADRRevPARTemporadas({ reporte }: { reporte: ReporteOcupacionTemporadas }) {
  const [animar, setAnimar] = useState(false);
  useEffect(() => { setAnimar(false); requestAnimationFrame(() => setAnimar(true)); }, [reporte.desglose.length]);

  // Aggregate by season
  const temporadas = [...new Set(reporte.desglose.map(d => d.season_name))].sort();
  const datosTemporada = temporadas.map(temporada => {
    const filas = reporte.desglose.filter(d => d.season_name === temporada);
    const totalNoches = filas.reduce((sum, f) => sum + f.noches_ocupadas, 0);
    const totalIngresos = filas.reduce((sum, f) => sum + f.ingresos_alojamiento, 0);
    const adr = totalNoches > 0 ? totalIngresos / totalNoches : 0;
    const revpar = reporte.resumen.capacidad_total_noches > 0 ? totalIngresos / reporte.resumen.capacidad_total_noches : 0;
    return { temporada, adr, revpar, noches: totalNoches, ingresos: totalIngresos };
  });

  const ancho = Math.max(600, temporadas.length * 100 + 100);
  const alto = 250;
  const x0 = 60;
  const x1 = ancho - 30;
  const y0 = 200;
  const altura = 160;

  const maximoAdr = Math.max(1, ...datosTemporada.map(d => d.adr));
  const maximoRevpar = Math.max(1, ...datosTemporada.map(d => d.revpar));
  const maximo = Math.max(maximoAdr, maximoRevpar);

  const x = (i: number) => temporadas.length <= 1 ? (x0 + x1) / 2 : x0 + i / (temporadas.length - 1) * (x1 - x0);
  const yAdr = (valor: number) => y0 - valor / maximo * altura;
  const yRevpar = (valor: number) => y0 - valor / maximo * altura;

  const trazadoAdr = datosTemporada.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${yAdr(d.adr)}`).join(" ");
  const trazadoRevpar = datosTemporada.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${yRevpar(d.revpar)}`).join(" ");

  const compacto = (valor: number) => new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(valor);
  const colores = { adr: "#3f7a5e", revpar: "#b08d48" };
  const etiquetas = { adr: "ADR (Tarifa promedio)", revpar: "RevPAR (Ingreso por noche disp.)" };

  return (
    <div className="overflow-x-auto pb-2">
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-carbon/70" aria-label="Métricas">
        <span className="inline-flex items-center gap-2 animate-slide-in stagger-1">
          <span className="h-1 w-5 rounded" style={{ backgroundColor: colores.adr }} />{etiquetas.adr}
        </span>
        <span className="inline-flex items-center gap-2 animate-slide-in stagger-2">
          <span className="h-1 w-5 rounded" style={{ backgroundColor: colores.revpar }} />{etiquetas.revpar}
        </span>
      </div>
      <svg width={ancho} viewBox={`0 0 ${ancho} ${alto}`} className="max-w-none" role="img" aria-label="Tendencia de ADR y RevPAR por temporada">
        <title>Evolución de ADR y RevPAR por temporada</title>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(fraccion => (
          <g key={fraccion} className="animate-fade-in stagger-1">
            <line x1={x0} x2={x1} y1={yAdr(maximo * fraccion)} y2={yAdr(maximo * fraccion)} stroke="#e8e0d4" strokeDasharray="4 5" />
            <text x={x0 - 8} y={yAdr(maximo * fraccion) + 4} textAnchor="end" fontSize="10" fill="#756f67">{compacto(maximo * fraccion)}</text>
          </g>
        ))}
        {/* ADR line */}
        <path
          d={trazadoAdr}
          fill="none"
          stroke={colores.adr}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="stagger-2 animate-fade-in"
          style={{
            opacity: animar ? 1 : 0,
            transition: "opacity 1s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
        {/* RevPAR line */}
        <path
          d={trazadoRevpar}
          fill="none"
          stroke={colores.revpar}
          strokeWidth={3}
          strokeDasharray="6 4"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="stagger-3 animate-fade-in"
          style={{
            opacity: animar ? 1 : 0,
            transition: "opacity 1s cubic-bezier(0.4, 0, 0.2, 1)",
            transitionDelay: "200ms",
          }}
        />
        {/* Points and labels */}
        {datosTemporada.map((d, i) => (
          <g key={d.temporada} className="animate-fade-in stagger-4" style={{ animationDelay: `${i * 80}ms` }}>
            {/* ADR point */}
            <circle cx={x(i)} cy={yAdr(d.adr)} r={5} fill={colores.adr} stroke="white" strokeWidth={2}>
              <title>{d.temporada} - ADR: {formatearMoneda(d.adr)}</title>
            </circle>
            {/* RevPAR point */}
            <circle cx={x(i)} cy={yRevpar(d.revpar)} r={5} fill={colores.revpar} stroke="white" strokeWidth={2}>
              <title>{d.temporada} - RevPAR: {formatearMoneda(d.revpar)}</title>
            </circle>
            {/* Season label */}
            <text x={x(i)} y={y0 + 22} textAnchor="middle" fontSize={10} fill="#756f67">{d.temporada}</text>
          </g>
        ))}
      </svg>
      <p className="mt-2 text-right text-xs text-carbon/55">Escala vertical: pesos argentinos</p>
    </div>
  );
}