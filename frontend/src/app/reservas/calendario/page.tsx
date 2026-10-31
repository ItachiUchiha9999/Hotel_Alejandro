"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { InfoBox } from "@/components/ui/InfoBox";
import { api, getReservas, ApiError } from "@/lib/api";
import {
  format,
  startOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
} from "date-fns";
import { es } from "date-fns/locale";

type TipoEvento = "reserva" | "bloqueo" | "mantenimiento" | "evento";

interface EventoCalendario {
  id: number;
  titulo: string;
  fechaInicio: Date;
  fechaFin: Date;
  tipo: TipoEvento;
}

interface MantenimientoItem {
  maintenance_id: number;
  maintenance_type: string;
  start_date: string;
  estimated_end_date: string;
  room?: { room_number: string } | null;
  room_id: number;
}

/** El color y la etiqueta salen del tipo: la leyenda y las barras no pueden desincronizarse. */
const tiposConfig: Record<TipoEvento, { label: string; color: string }> = {
  reserva: { label: "Reservas", color: "bg-gold-500" },
  mantenimiento: { label: "Mantenimiento", color: "bg-neutral-500" },
  bloqueo: { label: "Bloqueos", color: "bg-danger-500" },
  evento: { label: "Eventos", color: "bg-info-500" },
};

const diasSemana = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MAX_EVENTOS_POR_DIA = 3;

export default function CalendarioPage() {
  const [mesActual, setMesActual] = useState(() => new Date());
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      // Traer reservas, mantenimientos y bloqueos
      const [reservas, mantenimientos] = await Promise.all([
        getReservas({}),
        api.get<MantenimientoItem[]>("/housekeeping?abiertos=true"),
      ]);

      const eventosReservas: EventoCalendario[] = reservas
        .filter((r) => r.reservation_status !== "CANCELADA")
        .map((r) => ({
          id: r.reservation_id,
          titulo: `${r.reservation_code} - ${r.guest.last_name}, ${r.guest.first_name}`,
          fechaInicio: startOfDay(new Date(r.check_in_date)),
          fechaFin: startOfDay(new Date(r.check_out_date)),
          tipo: "reserva" as TipoEvento,
        }));

      const eventosMantenimiento: EventoCalendario[] = mantenimientos.map((m) => ({
        id: m.maintenance_id,
        titulo: `${m.maintenance_type} Hab. ${m.room?.room_number ?? m.room_id}`,
        fechaInicio: startOfDay(new Date(m.start_date)),
        fechaFin: startOfDay(new Date(m.estimated_end_date)),
        tipo: m.maintenance_type === "LIMPIEZA" ? "mantenimiento" : "bloqueo",
      }));

      setEventos([...eventosReservas, ...eventosMantenimiento]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el calendario.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Recargar al cambiar de mes para traer eventos del nuevo rango
  useEffect(() => {
    cargar();
  }, [mesActual, cargar]);

  const diasCalendario = eachDayOfInterval({
    start: startOfWeek(startOfMonth(mesActual), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(mesActual), { weekStartsOn: 1 }),
  });

  // Se compara por día calendario (sin horas) para que el último día del evento sea inclusivo
  const obtenerEventosDia = (fecha: Date) => {
    const dia = startOfDay(fecha).getTime();
    return eventos.filter(
      (e) => dia >= startOfDay(e.fechaInicio).getTime() && dia <= startOfDay(e.fechaFin).getTime()
    );
  };

  const titulo = format(mesActual, "MMMM yyyy", { locale: es });
  const tituloCapitalizado = titulo.charAt(0).toUpperCase() + titulo.slice(1);

  return (
    <>
      <PageHeader
        titulo="Calendario de reservas"
        descripcion="Vista mensual de ocupación y eventos"
        acciones={
          <Link href="/reservas/nueva">
            <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>
              Nueva reserva
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-neutral-900" aria-live="polite">
          {tituloCapitalizado}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setMesActual((m) => subMonths(m, 1))} aria-label="Mes anterior">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMesActual(new Date())}>
            Hoy
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setMesActual((m) => addMonths(m, 1))} aria-label="Mes siguiente">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <InfoBox tipo="error">
            {error}{" "}
            <button type="button" onClick={cargar} className="underline underline-offset-2">
              Reintentar
            </button>
          </InfoBox>
        </div>
      )}

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Encabezado de días de la semana */}
            <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50">
              {diasSemana.map((dia) => (
                <div
                  key={dia}
                  className="px-2 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider"
                >
                  {dia}
                </div>
              ))}
            </div>

            {/* Días del calendario */}
            <div className="grid grid-cols-7">
              {diasCalendario.map((dia) => {
                const esMesActual = isSameMonth(dia, mesActual);
                const esHoy = isToday(dia);
                const eventosDia = obtenerEventosDia(dia);

                return (
                  <div
                    key={format(dia, "yyyy-MM-dd")}
                    className={`min-h-[110px] border-r border-b border-neutral-100 p-2 ${
                      esHoy ? "bg-gold-50" : esMesActual ? "bg-white" : "bg-neutral-50"
                    }`}
                  >
                    <div
                      className={`text-sm font-medium ${
                        esHoy ? "text-gold-600" : esMesActual ? "text-neutral-900" : "text-neutral-400"
                      }`}
                    >
                      {format(dia, "d")}
                    </div>

                    {eventosDia.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {eventosDia.slice(0, MAX_EVENTOS_POR_DIA).map((evento) => (
                          <div
                            key={evento.id}
                            className={`text-xs px-1.5 py-0.5 rounded truncate text-white ${tiposConfig[evento.tipo].color}`}
                            title={evento.titulo}
                          >
                            {evento.titulo}
                          </div>
                        ))}
                        {eventosDia.length > MAX_EVENTOS_POR_DIA && (
                          <p className="text-xs text-neutral-500 text-center">
                            +{eventosDia.length - MAX_EVENTOS_POR_DIA} más
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Leyenda */}
      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-sm font-medium text-neutral-700">Leyenda</span>
          {(Object.keys(tiposConfig) as TipoEvento[]).map((tipo) => (
            <div key={tipo} className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded ${tiposConfig[tipo].color}`} aria-hidden="true" />
              <span className="text-sm text-neutral-600">{tiposConfig[tipo].label}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}