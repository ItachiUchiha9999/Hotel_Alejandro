"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Download, BedDouble, Calendar, ArrowRight, DollarSign, Percent, TrendingUp, AlertTriangle, Users, Building2, CreditCard, CheckCircle, PieChart, BarChart2, Activity } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Table, TableContainer, TableHeader, TableBody, TableRow, TableHead, TableCell, InfoBox } from "@/components/ui";
import { api, authHeaders, urlDescarga, getReporteOcupacionTemporadas, type ReporteOcupacionTemporadas } from "@/lib/api";
import type { FilaSaldo, Movimiento } from "@/lib/types";
import { EmptyStates, CardSkeleton, TableSkeleton } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ComparativaFinanciera } from "@/components/finanzas/ComparativaFinanciera";

type PeriodoFinanciero = "SEMANA" | "MES" | "ANIO";
interface PuntoFinanciero { pendiente?: boolean; fecha: string; ingresos: number; egresos: number; neto: number; margen_porcentual: number | null; }
interface MovimientoFinanciero { fecha: string; tipo: "INGRESO" | "EGRESO"; detalle: string; importe: number; }
interface ReporteFinanciero {
  periodo: PeriodoFinanciero;
  desde: string;
  hasta: string;
  serie: PuntoFinanciero[];
  totales: { ingresos: number; egresos: number; neto: number; margen_porcentual: number | null };
  comparacion: { desde: string; hasta: string; totales: { ingresos: number; egresos: number; neto: number; margen_porcentual: number | null } };
  movimientos: MovimientoFinanciero[];
}

const fechaLocalHoy = () => {
  const hoy = new Date();
  hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
  return hoy.toISOString().slice(0, 10);
};

const moneda = (valor: number) => valor.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const monedaCompacta = (valor: number) => new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(valor);
const variacionTexto = (actual: number, anterior: number) => anterior === 0 ? (actual === 0 ? "Sin cambios respecto al período anterior" : "Nuevo en este período") : `${actual - anterior >= 0 ? "+" : ""}${(((actual - anterior) / anterior) * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}% vs. período anterior`;
const fechaCorta = (valor: string) => new Date(`${valor}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

// Metric Card Component
function MetricCard({
  icon,
  title,
  value,
  subtitle,
  trend,
  trendPositive = true,
  loading = false,
  iconBg = "bg-gold-100",
  iconColor = "text-gold-600"
}: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  trendPositive?: boolean;
  loading?: boolean;
  iconBg?: string;
  iconColor?: string;
}) {
  return (
    <Card variant="outlined" padding="md" hover>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{title}</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900 tabular-nums">{loading ? "—" : value}</p>
          {subtitle && <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>}
          {trend && (
            <p className="mt-1 text-xs font-medium" style={{ color: trendPositive ? '#1a9c33' : '#ef4444' }}>
              {trend}
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-xl flex-shrink-0", iconBg)}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

// Donut chart for income/expense distribution
function DonutFinanciero({ reporte }: { reporte: ReporteFinanciero }) {
  const [animar, setAnimar] = useState(false);
  useEffect(() => { setAnimar(false); requestAnimationFrame(() => setAnimar(true)); }, [reporte.totales.ingresos, reporte.totales.egresos]);

  const radio = 70;
  const grosor = 16;
  const circunferencia = 2 * Math.PI * radio;
  const total = (reporte.totales.ingresos || 0) + (reporte.totales.egresos || 0);
  const porcIngresos = total > 0 ? (reporte.totales.ingresos || 0) / total : 0.5;
  const porcEgresos = total > 0 ? (reporte.totales.egresos || 0) / total : 0.5;

  return (
    <div className="flex flex-col items-center justify-center min-h-[180px]">
      <svg viewBox={`0 0 ${radio * 2} ${radio * 2}`} width="160" height="160" role="img" aria-label="Distribución ingresos vs egresos">
        {/* Background circle */}
        <circle cx={radio} cy={radio} r={radio - grosor / 2} fill="none" stroke="#e8e0d4" strokeWidth={grosor} />
        {/* Ingresos */}
        <circle
          cx={radio} cy={radio} r={radio - grosor / 2}
          fill="none" stroke="#1a9c33"
          strokeWidth={grosor}
          strokeDasharray={`${porcIngresos * circunferencia} ${circunferencia}`}
          strokeDashoffset={animar ? 0 : circunferencia}
          strokeLinecap="round"
          className="animate-scale-in stagger-1"
          style={{
            transformOrigin: `${radio}px ${radio}px`,
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <title>Ingresos: {moneda(reporte.totales.ingresos || 0)} ({(porcIngresos * 100).toFixed(1)}%)</title>
        </circle>
        {/* Egresos */}
        <circle
          cx={radio} cy={radio} r={radio - grosor / 2}
          fill="none" stroke="#ef4444"
          strokeWidth={grosor}
          strokeDasharray={`${porcEgresos * circunferencia} ${circunferencia}`}
          strokeDashoffset={animar ? -porcIngresos * circunferencia : circunferencia}
          strokeLinecap="round"
          className="animate-scale-in stagger-2"
          style={{
            transformOrigin: `${radio}px ${radio}px`,
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
            transitionDelay: "200ms",
          }}
        >
          <title>Egresos: {moneda(reporte.totales.egresos || 0)} ({(porcEgresos * 100).toFixed(1)}%)</title>
        </circle>
        {total === 0 && (
          <circle cx={radio} cy={radio} r={radio - grosor / 2} fill="none" stroke="#e8e0d4" strokeWidth={grosor} />
        )}
      </svg>
      <div className="mt-4 text-center space-y-1">
        <p className="text-sm font-medium text-neutral-900">{total > 0 ? `${porcIngresos < porcEgresos ? "−" : ""}${(porcIngresos - porcEgresos) * 100 > 0 ? "+" : ""}${(Math.abs(porcIngresos - porcEgresos) * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%` : "Sin datos"}</p>
        <p className="text-xs text-neutral-500">Diferencia ingresos/egresos</p>
      </div>
    </div>
  );
}

// Line chart for financial trend
function LineaTendenciaFinanciera({ reporte }: { reporte: ReporteFinanciero }) {
  const [animar, setAnimar] = useState(false);
  useEffect(() => { setAnimar(false); requestAnimationFrame(() => setAnimar(true)); }, [reporte.serie.length, reporte.periodo]);

  const ancho = Math.max(600, reporte.serie.length * 45 + 80);
  const alto = 220;
  const x0 = 55;
  const x1 = ancho - 25;
  const y0 = 180;
  const altura = 150;
  const maximo = Math.max(1, ...reporte.serie.flatMap(p => [p.ingresos, p.egresos, Math.abs(p.neto)]));
  const x = (i: number) => reporte.serie.length <= 1 ? (x0 + x1) / 2 : x0 + i / (reporte.serie.length - 1) * (x1 - x0);
  const y = (valor: number) => y0 - (valor / maximo) * altura;
  const trazado = (tipo: "ingresos" | "egresos" | "neto") => reporte.serie.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p[tipo] || 0)}`).join(" ");
  const compacto = (valor: number) => new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(valor);
  const etiqueta = (valor: string) => reporte.periodo === "ANIO" ? new Date(`${valor}T12:00:00Z`).toLocaleDateString("es-AR", { month: "short", year: "2-digit", timeZone: "UTC" }) : `${valor.slice(8, 10)}`;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-700" aria-label="Series">
        <span className="inline-flex items-center gap-2 animate-slide-in stagger-1"><span className="h-1 w-5 rounded bg-success-500" />Ingresos</span>
        <span className="inline-flex items-center gap-2 animate-slide-in stagger-2"><span className="h-1 w-5 rounded bg-danger-500" />Egresos</span>
        <span className="inline-flex items-center gap-2 animate-slide-in stagger-3"><span className="h-1 w-5 rounded bg-gold-400" />Resultado</span>
      </div>
      <svg width={ancho} viewBox={`0 0 ${ancho} ${alto}`} className="max-w-none" role="img" aria-label="Tendencia financiera: ingresos, egresos y resultado por período">
        <title>Evolución de ingresos, egresos y resultado neto</title>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(fraccion => (
          <g key={fraccion} className="animate-fade-in stagger-1">
            <line x1={x0} x2={x1} y1={y(maximo * fraccion)} y2={y(maximo * fraccion)} stroke="#e8e0d4" strokeDasharray="4 5" />
            <text x={x0 - 8} y={y(maximo * fraccion) + 4} textAnchor="end" fontSize="10" fill="#756f67">{compacto(maximo * fraccion)}</text>
          </g>
        ))}
        {/* Zero line */}
        <line x1={x0} x2={x1} y1={y(0)} y2={y(0)} stroke="#d4c8b8" strokeWidth={1.5} className="animate-fade-in stagger-1" />
        {/* Ingresos line */}
        <path d={trazado("ingresos")} fill="none" stroke="#1a9c33" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" className="stagger-2 animate-fade-in" style={{ opacity: animar ? 1 : 0, transition: "opacity 1s cubic-bezier(0.4, 0, 0.2, 1)" }} />
        {/* Egresos line */}
        <path d={trazado("egresos")} fill="none" stroke="#ef4444" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" className="stagger-3 animate-fade-in" style={{ opacity: animar ? 1 : 0, transition: "opacity 1s cubic-bezier(0.4, 0, 0.2, 1)", transitionDelay: "150ms" }} />
        {/* Neto line */}
        <path d={trazado("neto")} fill="none" stroke="#b08d48" strokeWidth={3} strokeDasharray="6 4" strokeLinejoin="round" strokeLinecap="round" className="stagger-4 animate-fade-in" style={{ opacity: animar ? 1 : 0, transition: "opacity 1s cubic-bezier(0.4, 0, 0.2, 1)", transitionDelay: "300ms" }} />
        {/* Points */}
        {reporte.serie.map((p, i) => (
          <g key={p.fecha} className="animate-fade-in stagger-5" style={{ animationDelay: `${(i % 10) * 60}ms` }}>
            {p.ingresos && <circle cx={x(i)} cy={y(p.ingresos)} r={4} fill="#1a9c33" stroke="white" strokeWidth={2}><title>Ingresos: {moneda(p.ingresos)}</title></circle>}
            {p.egresos && <circle cx={x(i)} cy={y(p.egresos)} r={4} fill="#ef4444" stroke="white" strokeWidth={2}><title>Egresos: {moneda(p.egresos)}</title></circle>}
            <circle cx={x(i)} cy={y(p.neto)} r={4} fill="#b08d48" stroke="white" strokeWidth={2}><title>Resultado: {moneda(p.neto)}</title></circle>
            <text x={x(i)} y={y0 + 22} textAnchor="middle" fontSize={10} fill="#756f67">{etiqueta(p.fecha)}</text>
          </g>
        ))}
      </svg>
      <p className="mt-2 text-right text-xs text-neutral-55">Escala vertical: pesos argentinos</p>
    </div>
  );
}

import { cn } from "@/lib/utils";

export default function InicioPage() {
  const { toast } = useToast();
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
  const [fechaSeleccionadaGrafico, setFechaSeleccionadaGrafico] = useState<string | null>(null);

  // REP-08: Estado del panel de ocupación y tarifas estacionales
  const [reporteOcupacion, setReporteOcupacion] = useState<ReporteOcupacionTemporadas | null>(null);
  const [cargandoOcupacion, setCargandoOcupacion] = useState(true);

  // Cargar datos operativos (stock)
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

  // Cargar reporte financiero
  useEffect(() => {
    let vigente = true;
    setCargandoReporte(true); setErrorReporte(false); setReporte(null);
    api.get<ReporteFinanciero>(`/dashboard/finanzas?periodo=${periodo}&fecha=${fechaFinanzas}`)
      .then((data) => { if (vigente) { setReporte(data); setFechaSeleccionadaGrafico(data.serie[0]?.fecha || null); } })
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
      toast({ type: "success", title: "Exportación completada", message: `Reporte descargado en formato ${formato.toUpperCase()}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo descargar el reporte.";
      setErrorExportacion(msg);
      toast({ type: "error", title: "Error al exportar", message: msg });
    } finally {
      setExportando(null);
    }
  }

  const kpis = [
    {
      icon: <DollarSign className="w-5 h-5" />,
      title: "Ingresos registrados",
      value: moneda(reporte?.totales.ingresos ?? 0),
      trend: variacionTexto(reporte?.totales.ingresos ?? 0, reporte?.comparacion.totales.ingresos ?? 0),
      trendPositive: (reporte?.totales.ingresos ?? 0) >= (reporte?.comparacion.totales.ingresos ?? 0),
      loading: cargandoReporte,
      iconBg: "bg-success-100",
      iconColor: "text-success-600"
    },
    {
      icon: <CreditCard className="w-5 h-5" />,
      title: "Egresos pagados",
      value: moneda(reporte?.totales.egresos ?? 0),
      trend: variacionTexto(reporte?.totales.egresos ?? 0, reporte?.comparacion.totales.egresos ?? 0),
      trendPositive: (reporte?.totales.egresos ?? 0) <= (reporte?.comparacion.totales.egresos ?? 0),
      loading: cargandoReporte,
      iconBg: "bg-danger-100",
      iconColor: "text-danger-600"
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: "Resultado del período",
      value: moneda(reporte?.totales.neto ?? 0),
      trend: reporte ? `Margen: ${reporte.totales.margen_porcentual?.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%` : undefined,
      trendPositive: (reporte?.totales.neto ?? 0) >= 0,
      loading: cargandoReporte,
      iconBg: (reporte?.totales.neto ?? 0) < 0 ? "bg-danger-100" : "bg-gold-100",
      iconColor: (reporte?.totales.neto ?? 0) < 0 ? "text-danger-600" : "text-gold-600"
    },
    {
      icon: <Percent className="w-5 h-5" />,
      title: "Margen porcentual",
      value: reporte?.totales.margen_porcentual === null ? "Sin ingresos" : `${reporte?.totales.margen_porcentual?.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`,
      loading: cargandoReporte,
      iconBg: "bg-info-100",
      iconColor: "text-info-600"
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="SIGH · Sistema de Gestión Hotelera"
        titulo="Hotel Alejandro I"
        descripcion="Resumen financiero, operativo y rendimiento de reservas por temporada."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variante="secundario"
              disabled={!reporte || cargandoReporte || exportando !== null}
              cargando={exportando === "pdf"}
              onClick={() => exportarFinanzas("pdf")}
              leftIcon={<Download className="w-4 h-4" />}
            >
              PDF
            </Button>
            <Button
              variante="secundario"
              disabled={!reporte || cargandoReporte || exportando !== null}
              cargando={exportando === "xlsx"}
              onClick={() => exportarFinanzas("xlsx")}
              leftIcon={<Download className="w-4 h-4" />}
            >
              Excel
            </Button>
          </div>
        }
      />

      {/* Alertas de stock */}
      <Card variant="outlined" padding="md" className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning-500" />
            Alertas de stock
          </CardTitle>
          <CardDescription>
            {cargandoOperativo ? "Consultando niveles de inventario…" : sinBackend ? "No se pudo verificar el inventario." : bajoMinimo.length > 0 ? `${bajoMinimo.length} artículo(s) necesitan reposición.` : "No hay artículos por debajo del mínimo configurado."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cargandoOperativo ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-gold-400 border-t-transparent" />
              <span className="ml-2 text-sm text-neutral-500">Cargando stock…</span>
            </div>
          ) : sinBackend ? (
            <InfoBox tipo="error">No se pudo verificar el inventario. Revisá la conexión con el servidor.</InfoBox>
          ) : bajoMinimo.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-neutral-500">
              <CheckCircle className="w-8 h-8 text-success-500 mr-2" />
              Todo en orden. No hay alertas de stock.
            </div>
          ) : (
            <TableContainer>
              <TableHeader>
                <TableRow>
                  <TableHead>Artículo</TableHead>
                  <TableHead>Depósito</TableHead>
                  <TableHead align="right">Actual / Mínimo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bajoMinimo.slice(0, 10).map((f) => (
                  <TableRow key={f.stock_id}>
                    <TableCell className="font-medium">{f.articles.article_name}</TableCell>
                    <TableCell className="text-sm text-neutral-500">{f.deposit.deposit_name}</TableCell>
                    <TableCell align="right" className="tabular-nums font-mono">
                      {Number(f.stock_amount)} / {Number(f.articles.article_stock_min_general)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="danger" dot>Bajo mínimo</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </TableContainer>
          )}
        </CardContent>
        {bajoMinimo.length > 10 && (
          <CardFooter>
            <Link href="/inventario" className="text-sm font-medium text-gold-600 hover:underline">
              Ver todas las alertas ({bajoMinimo.length}) →
            </Link>
          </CardFooter>
        )}
      </Card>

      {/* Ocupación y Rendimiento por Temporada */}
      <Card variant="outlined" padding="md" className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gold-500" />
            Ocupación y Rendimiento por Temporada
          </CardTitle>
          <CardDescription>Desempeño acumulado en el mes corriente según tarifas estacionales.</CardDescription>
        </CardHeader>
        <CardContent>
          {cargandoOcupacion ? (
            <CardSkeleton count={4} />
          ) : reporteOcupacion ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                icon={<Percent className="w-5 h-5" />}
                title="Tasa de Ocupación"
                value={`${reporteOcupacion.resumen.tasa_ocupacion_global_pct}%`}
                subtitle={`${reporteOcupacion.resumen.noches_ocupadas} de ${reporteOcupacion.resumen.capacidad_total_noches} noches`}
                iconBg="bg-gold-100"
                iconColor="text-gold-600"
              />
              <MetricCard
                icon={<DollarSign className="w-5 h-5" />}
                title="Ingresos Alojamiento"
                value={moneda(reporteOcupacion.resumen.ingresos_totales_alojamiento)}
                subtitle="Facturación bruta estacional"
                iconBg="bg-success-100"
                iconColor="text-success-600"
              />
              <MetricCard
                icon={<BedDouble className="w-5 h-5" />}
                title="ADR (Tarifa Promedio)"
                value={moneda(reporteOcupacion.resumen.adr_global)}
                subtitle="Por noche vendida"
                iconBg="bg-info-100"
                iconColor="text-info-600"
              />
              <MetricCard
                icon={<Calendar className="w-5 h-5" />}
                title="RevPAR"
                value={moneda(reporteOcupacion.resumen.revpar)}
                subtitle="Por noche disponible"
                iconBg="bg-purple-100"
                iconColor="text-purple-600"
              />
            </div>
          ) : (
            <InfoBox tipo="error">No se pudo cargar el reporte de ocupación.</InfoBox>
          )}
          <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center justify-between">
            <span className="text-xs text-neutral-500">
              Cálculo cruzado entre reservas efectivas y tarifas configuradas por temporada.
            </span>
            <Link
              href="/reportes/temporadas"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-700 hover:text-gold-600 transition-colors"
            >
              Ver reporte analítico completo
              <ArrowRight size={14} />
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Resumen financiero */}
      <Card variant="outlined" padding="md" className="mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Resumen financiero</CardTitle>
              <CardDescription>Ingresos cobrados, egresos pagados y resultado neto por fecha.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
              <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-1" role="group" aria-label="Período del reporte">
                {(["SEMANA", "MES", "ANIO"] as const).map((opcion) => (
                  <button
                    key={opcion}
                    type="button"
                    onClick={() => setPeriodo(opcion)}
                    aria-pressed={periodo === opcion}
                    className={cn(
                      "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                      periodo === opcion
                        ? "bg-white text-neutral-900 shadow-sm"
                        : "text-neutral-600 hover:text-neutral-900 hover:bg-white"
                    )}
                  >
                    {opcion === "SEMANA" ? "Semana" : opcion === "MES" ? "Mes" : "Año"}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm text-neutral-600">
                {periodo === "ANIO" ? "Año del reporte" : periodo === "SEMANA" ? "Fecha de la semana" : "Fecha del mes"}
                {periodo === "ANIO" ? (
                  <select
                    value={fechaFinanzas.slice(0, 4)}
                    onChange={e => setFechaFinanzas(`${e.target.value}-01-01`)}
                    className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-400/20"
                  >
                    {Array.from({ length: new Date().getFullYear() - 1998 }, (_, i) => new Date().getFullYear() + 1 - i).map(anio => (
                      <option key={anio} value={anio}>{anio}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="date"
                    value={fechaFinanzas}
                    onChange={(e) => setFechaFinanzas(e.target.value)}
                    className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-400/20"
                  />
                )}
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {errorExportacion && <InfoBox tipo="error" className="mb-4">{errorExportacion}</InfoBox>}
          {errorReporte ? (
            <InfoBox tipo="error">No se pudo cargar el resumen financiero. Revisá que el backend y la base de datos estén disponibles.</InfoBox>
          ) : (
            <>
              {/* KPIs Grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                {kpis.map((kpi, i) => (
                  <MetricCard key={i} {...kpi} />
                ))}
              </div>

              {/* Additional Charts Row */}
              {reporte && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 mb-6 animate-slide-up-slow">
                  <Card titulo="Distribución Ingresos vs Egresos" descripcion="Participación relativa de ingresos y egresos en el período." className="stagger-1 animate-slide-up-slow">
                    <DonutFinanciero reporte={reporte} />
                  </Card>
                  <Card titulo="Tendencia financiera" descripcion="Evolución de ingresos, egresos y resultado neto a lo largo del período." className="stagger-2 animate-slide-up-slow">
                    <LineaTendenciaFinanciera reporte={reporte} />
                  </Card>
                </div>
              )}

              {cargandoReporte && !reporte ? (
                <CardSkeleton count={4} />
              ) : reporte && (
                <>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                    <span>{periodo === "ANIO" ? `Año ${reporte.desde.slice(0, 4)}` : `${fechaCorta(reporte.desde)} — ${fechaCorta(reporte.hasta)}`}</span>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-success-500" /> Ingresos</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-danger-500" /> Egresos</span>
                      <span className="flex items-center gap-1.5"><span className="w-5 h-0.5 bg-gold-400" /> Resultado</span>
                    </div>
                  </div>

                  {/* Financial Chart */}
                  <ComparativaFinanciera
                    points={reporte.serie}
                    selectedDate={fechaSeleccionadaGrafico}
                    onSelectDate={setFechaSeleccionadaGrafico}
                    period={periodo}
                  />

                  {/* Detail Table */}
                  <div className="mt-6 border-t border-neutral-100 pt-6">
                    <h3 className="mb-4 text-lg font-semibold text-neutral-900">Resultado por {periodo === "ANIO" ? "mes" : "día"}</h3>
                    <TableContainer>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{periodo === "ANIO" ? "Mes" : "Fecha"}</TableHead>
                          <TableHead align="right">Ingresos</TableHead>
                          <TableHead align="right">Egresos</TableHead>
                          <TableHead align="right">Resultado</TableHead>
                          <TableHead align="right">Margen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reporte.serie.map(punto => (
                          <TableRow key={punto.fecha} className={punto.neto < 0 ? "bg-danger-50" : undefined}>
                            <TableCell>
                              {periodo === "ANIO"
                                ? format(new Date(`${punto.fecha}T12:00:00`), "MMMM", { locale: es })
                                : fechaCorta(punto.fecha)}
                              {punto.pendiente && <Badge variant="ghost" className="ml-2">Pendiente</Badge>}
                            </TableCell>
                            <TableCell align="right" className="tabular-nums">{punto.pendiente ? "—" : moneda(punto.ingresos)}</TableCell>
                            <TableCell align="right" className="tabular-nums">{punto.pendiente ? "—" : moneda(punto.egresos)}</TableCell>
                            <TableCell align="right" className={cn("font-medium tabular-nums", punto.neto < 0 ? "text-danger-700" : "text-neutral-900")}>
                              {punto.pendiente ? "—" : moneda(punto.neto)}
                            </TableCell>
                            <TableCell align="right" className={cn("tabular-nums", punto.neto < 0 ? "text-danger-700" : "text-neutral-600")}>
                              {punto.pendiente || punto.margen_porcentual === null ? "—" : `${punto.margen_porcentual.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </TableContainer>
                  </div>

                  {reporte.movimientos.length > 0 && (
                    <details className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
                      <summary className="cursor-pointer px-4 py-3 font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400">
                        Ver detalle de {reporte.movimientos.length} movimiento{reporte.movimientos.length === 1 ? "" : "s"}
                      </summary>
                      <div className="border-t border-neutral-100">
                        <TableContainer>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-28">Fecha</TableHead>
                              <TableHead className="w-32">Tipo</TableHead>
                              <TableHead>Detalle</TableHead>
                              <TableHead className="w-40 text-right">Importe</TableHead>
                              <TableHead className="w-28 text-center">Acceso</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reporte.movimientos.map((m, i) => (
                              <TableRow key={`${m.fecha}-${m.tipo}-${i}`}>
                                <TableCell className="whitespace-nowrap tabular-nums">{fechaCorta(m.fecha)}</TableCell>
                                <TableCell>
                                  <Badge variant={m.tipo === "INGRESO" ? "success" : "danger"}>
                                    {m.tipo === "INGRESO" ? "Ingreso" : "Egreso"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">{m.detalle}</TableCell>
                                <TableCell className="text-right font-semibold tabular-nums">{moneda(m.importe)}</TableCell>
                                <TableCell className="text-center">
                                  <Link
                                    href={m.tipo === "INGRESO" ? "/reservas" : "/proveedores/ordenes-pago"}
                                    className="text-sm font-medium text-gold-600 underline hover:text-gold-700"
                                  >
                                    {m.tipo === "INGRESO" ? "Reservas" : "Órdenes"}
                                  </Link>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </TableContainer>
                      </div>
                    </details>
                  )}

                  <p className="mt-4 rounded-lg bg-neutral-50 px-3 py-2 text-sm leading-6 text-neutral-600">
                    Ingresos: alojamiento y cargos de habitación cobrados. Egresos: órdenes de pago confirmadas.
                    Margen: resultado del período dividido por sus ingresos; si no hubo ingresos, no se calcula.
                  </p>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {sinBackend && (
        <InfoBox tipo="error" className="mb-6" titulo="Sin conexión con el servidor:">
          no se pudieron cargar los datos. Verificá que el backend esté corriendo en el
          puerto configurado en NEXT_PUBLIC_API_URL.
        </InfoBox>
      )}

      {/* Últimos movimientos */}
      <Card variant="outlined" padding="md">
        <CardHeader>
          <CardTitle>Últimos movimientos</CardTitle>
          <CardDescription>Las cinco operaciones más recientes.</CardDescription>
        </CardHeader>
        <CardContent>
          {movimientos.length === 0 ? (
            <EmptyStates.noData />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {movimientos.map((m) => (
                <li key={m.stock_movement_id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {m.movement_type.movement_type.replaceAll("_", " ")}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {m.deposit_origin?.deposit_name ?? "Proveedor"} →{" "}
                      {m.deposit_destination?.deposit_name ?? "Consumo"}
                    </p>
                  </div>
                  <span className="text-xs text-neutral-400 whitespace-nowrap">
                    {format(new Date(m.transaction_date), "dd MMM yyyy", { locale: es })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

