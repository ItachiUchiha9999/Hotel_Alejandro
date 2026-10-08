"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Calendar,
  DollarSign,
  BedDouble,
  Percent,
  Filter,
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
      {reporte && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
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

          <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
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

          <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
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

          <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
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

      {/* Tabla Desglosada */}
      <Card className="mt-6" titulo="Desglose por Temporada y Tipo de Habitación">
        {cargando ? (
          <p className="py-10 text-center text-sm text-carbon/50">Calculando métricas…</p>
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
                <tr key={`${fila.room_type_id}-${fila.season_name}-${idx}`} className="border-b border-line hover:bg-bone/40">
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