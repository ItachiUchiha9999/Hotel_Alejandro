"use client";

import { useState, type ComponentType } from "react";
import { FileText, BarChart3, TrendingUp, Calendar, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { format, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

type Categoria = "financiero" | "operacional" | "comercial";

interface Reporte {
  id: number;
  nombre: string;
  descripcion: string;
  categoria: Categoria;
  ruta: string;
  icono: ComponentType<{ className?: string }>;
}

const reportes: Reporte[] = [
  {
    id: 1,
    nombre: "Ingresos diarios",
    descripcion:
      "Resumen de ingresos por día con desglose por concepto (alojamiento, servicios, consumos). Incluye gráfico de evolución temporal y exportación a PDF/Excel.",
    categoria: "financiero",
    ruta: "/reportes/ingresos",
    icono: FileText,
  },
  {
    id: 2,
    nombre: "Egresos mensuales",
    descripcion:
      "Detalle de gastos y egresos por categoría (proveedores, compras de stock, gastos operativos). Gráfico de barras apiladas y exportación.",
    categoria: "financiero",
    ruta: "/reportes/egresos",
    icono: TrendingUp,
  },
  {
    id: 3,
    nombre: "Ocupación por tipo de habitación",
    descripcion:
      "Análisis de ocupación, ADR y RevPAR por categoría de habitación y temporada. Tabla desglosada con métricas clave.",
    categoria: "operacional",
    ruta: "/reportes/temporadas",
    icono: BarChart3,
  },
  {
    id: 4,
    nombre: "Reporte de housekeeping",
    descripcion: "Estado de habitaciones, tiempos de limpieza, rendimiento del equipo y tareas programadas.",
    categoria: "operacional",
    ruta: "/habitaciones/housekeeping",
    icono: FileText,
  },
  {
    id: 5,
    nombre: "Ventas por canal",
    descripcion:
      "Desglose de reservas por canal de venta (directo, OTA, corporativo, agencia) con métricas de conversión.",
    categoria: "comercial",
    ruta: "/reportes/ventas-canal",
    icono: TrendingUp,
  },
  {
    id: 6,
    nombre: "Cuentas por cobrar",
    descripcion: "Listado de facturas pendientes y vencimientos por cliente/proveedor con aging de deuda.",
    categoria: "financiero",
    ruta: "/proveedores/cuenta-corriente",
    icono: FileText,
  },
  {
    id: 7,
    nombre: "Stock crítico",
    descripcion: "Artículos por debajo del punto de reposición con alertas y valor de stock.",
    categoria: "operacional",
    ruta: "/stock/saldo",
    icono: BarChart3,
  },
  {
    id: 8,
    nombre: "Análisis de temporadas",
    descripcion:
      "Comparativo de ocupación, tarifas e ingresos entre temporadas (ALTA, BAJA, ESPECIAL) por tipo de habitación.",
    categoria: "comercial",
    ruta: "/reportes/temporadas",
    icono: Calendar,
  },
];

const tabsReportes = [
  { value: "todos", label: "Todos", count: reportes.length },
  { value: "financiero", label: "Financieros", count: reportes.filter((r) => r.categoria === "financiero").length },
  { value: "operacional", label: "Operacionales", count: reportes.filter((r) => r.categoria === "operacional").length },
  { value: "comercial", label: "Comerciales", count: reportes.filter((r) => r.categoria === "comercial").length },
];

const categoriaConfig: Record<
  Categoria,
  { label: string; variant: "success" | "info" | "default"; badge: string; bg: string; text: string }
> = {
  financiero: { label: "Financiero", variant: "success", badge: "", bg: "bg-success-100", text: "text-success-700" },
  operacional: { label: "Operacional", variant: "info", badge: "", bg: "bg-info-100", text: "text-info-700" },
  comercial: {
    label: "Comercial",
    variant: "default",
    badge: "bg-gold-100 text-gold-700",
    bg: "bg-gold-100",
    text: "text-gold-700",
  },
};

/** Las fechas "yyyy-MM-dd" se parsean como locales (new Date() las toma como UTC y muestra un día menos en Argentina). */
function fmt(valor: string, patron: string) {
  const d = parseISO(valor);
  return isValid(d) ? format(d, patron, { locale: es }) : "—";
}

export default function ReportesPage() {
  const [tabActivo, setTabActivo] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState(() => format(new Date(), "yyyy-MM-01"));
  const [fechaHasta, setFechaHasta] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const reportesFiltrados = reportes.filter((r) => tabActivo === "todos" || r.categoria === tabActivo);
  const rangoInvalido = fechaDesde !== "" && fechaHasta !== "" && fechaDesde > fechaHasta;

  return (
    <>
      <PageHeader
        titulo="Reportes y análisis"
        descripcion="Generá y visualizá reportes del hotel con datos en tiempo real"
        acciones={
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={fechaDesde}
              max={fechaHasta || undefined}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-40"
              aria-label="Fecha desde"
            />
            <span className="text-neutral-400 text-sm" aria-hidden="true">
              –
            </span>
            <Input
              type="date"
              value={fechaHasta}
              min={fechaDesde || undefined}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-40"
              aria-label="Fecha hasta"
            />
          </div>
        }
      />

      {rangoInvalido && (
        <p role="alert" className="mb-4 text-sm text-danger-700">
          La fecha “desde” no puede ser posterior a la fecha “hasta”.
        </p>
      )}

      <Card padding="none" className="overflow-hidden">
        <Tabs
          tabs={tabsReportes}
          activeTab={tabActivo}
          onChange={setTabActivo}
          variant="pills"
          fullWidth
        />
      </Card>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportesFiltrados.map((reporte) => {
          const Icon = reporte.icono;
          const cat = categoriaConfig[reporte.categoria];
          return (
            <Card
              key={reporte.id}
              className="flex flex-col border hover:shadow-lg hover:border-gold-300 transition-shadow group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded ${cat.bg} group-hover:scale-110 transition-transform`}
                  >
                    <Icon className={`w-4 h-4 ${cat.text}`} />
                  </div>
                  <Badge variant={cat.variant} className={`${cat.badge} text-xs`}>
                    {cat.label}
                  </Badge>
                </div>
                <h3 className="font-semibold text-neutral-900 mb-1 group-hover:text-gold-600 transition-colors text-sm">
                  {reporte.nombre}
                </h3>
                <p className="text-xs text-neutral-500 mb-3 line-clamp-3">{reporte.descripcion}</p>
                <p className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <Calendar className="w-3 h-3 shrink-0" />
                  Período: {fmt(fechaDesde, "dd/MM")} – {fmt(fechaHasta, "dd/MM/yyyy")}
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <Link href={reporte.ruta} className="block">
                  <Button className="w-full" leftIcon={<ExternalLink className="w-3 h-3" />} size="sm">
                    Abrir reporte
                  </Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </div>

      {reportesFiltrados.length === 0 && (
        <Card className="mt-6">
          <div className="text-center py-10 text-neutral-500">
            <FileText className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
            <h3 className="text-base font-medium text-neutral-900 mb-1">No hay reportes disponibles</h3>
            <p className="text-sm">No se encontraron reportes para la categoría seleccionada</p>
          </div>
        </Card>
      )}

      {/* Fuentes de datos y metodología */}
      <Card
        className="mt-6"
        titulo="Fuentes de datos y metodología"
        descripcion="Información sobre el origen de los datos utilizados en los reportes"
      >
        <div className="space-y-4 text-sm text-neutral-600">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="p-3 rounded bg-success-50 border border-success-200">
              <p className="font-medium text-success-800 mb-1 text-sm">Ingresos</p>
              <p className="text-xs">
                Cobros de alojamiento (reservation_payment) + servicios pagados (room_service_charge con paid_at).
                Fecha de cobro en zona horaria Argentina.
              </p>
            </div>
            <div className="p-3 rounded bg-danger-50 border border-danger-200">
              <p className="font-medium text-danger-800 mb-1 text-sm">Egresos</p>
              <p className="text-xs">
                Órdenes de pago confirmadas (payment_order status=1) clasificadas por categoría: proveedores,
                compras de stock, gastos operativos.
              </p>
            </div>
            <div className="p-3 rounded bg-info-50 border border-info-200">
              <p className="font-medium text-info-800 mb-1 text-sm">Ocupación</p>
              <p className="text-xs">
                Reservas con check-in realizado (IN_HOUSE, FINALIZADA). Noches = check_out - check_in. ADR =
                ingresos / noches ocupadas. RevPAR = ingresos / noches disponibles.
              </p>
            </div>
            <div className="p-3 rounded bg-gold-50 border border-gold-200">
              <p className="font-medium text-gold-800 mb-1 text-sm">Temporadas</p>
              <p className="text-xs">
                Tarifas vigentes por tipo de habitación (Room_Type_Rate) con season_name (GENERAL, ALTA, BAJA,
                ESPECIAL). Comparativo de métricas por temporada.
              </p>
            </div>
          </div>
          <div className="p-3 rounded bg-neutral-50 border border-neutral-200">
            <p className="font-medium text-neutral-800 mb-1 text-sm">Notas metodológicas</p>
            <ul className="list-disc list-inside text-xs space-y-1">
              <li>Todos los importes en pesos argentinos (ARS).</li>
              <li>Las fechas usan zona horaria America/Argentina/Buenos_Aires.</li>
              <li>Las semanas empiezan el lunes (ISO 8601).</li>
              <li>Los montos se redondean a 2 decimales; los totales pueden tener diferencias de centavos por redondeo.</li>
              <li>Los reportes excluyen reservas canceladas, no-show y pendientes sin confirmar.</li>
            </ul>
          </div>
        </div>
      </Card>
    </>
  );
}