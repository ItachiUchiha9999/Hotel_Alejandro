"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Badge, Button, Card, EmptyState, InfoBox, Table, THead, TH, TBody, TR, TD,
} from "@/components/ui";
import { BloqueoForm } from "@/components/housekeeping/BloqueoForm";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  ESTADO_UI,
  TIPO_BLOQUEO_UI,
  type Bloqueo,
  type EstadoHabitacion,
  type HabitacionTablero,
  type ResumenEstados,
} from "@/lib/housekeeping";

const fecha = (v: string) => new Date(v).toLocaleDateString("es-AR");

/** Filtros del tablero. "PENDIENTES" agrupa lo que Gobernanza tiene que resolver. */
type Filtro = "TODAS" | "PENDIENTES" | EstadoHabitacion;

/**
 * HU-9 (HAB-06) — Housekeeping.
 *
 * Es la pantalla de trabajo de Gobernanza. Arriba muestra cuántas habitaciones
 * hay en cada estado; abajo, un tablero por habitación con la acción que
 * corresponde según su estado:
 *   - DISPONIBLE          -> Bloquear
 *   - LIMPIEZA            -> Marcar limpia
 *   - MANTENIMIENTO / F.S -> Finalizar
 *   - OCUPADA             -> Programar (solo a futuro)
 */
export default function HousekeepingPage() {
  const [habitaciones, setHabitaciones] = useState<HabitacionTablero[]>([]);
  const [resumen, setResumen] = useState<ResumenEstados | null>(null);
  const [abiertos, setAbiertos] = useState<Bloqueo[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("PENDIENTES");

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<number | null>(null);
  const [bloqueando, setBloqueando] = useState<HabitacionTablero | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [t, r, a] = await Promise.all([
        api.get<HabitacionTablero[]>("/housekeeping/tablero"),
        api.get<ResumenEstados>("/housekeeping/resumen"),
        api.get<Bloqueo[]>("/housekeeping?abiertos=true"),
      ]);
      setHabitaciones(t);
      setResumen(r);
      setAbiertos(a);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el tablero.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = useMemo(() => {
    if (filtro === "TODAS") return habitaciones;
    if (filtro === "PENDIENTES") {
      return habitaciones.filter((h) =>
        ["LIMPIEZA", "MANTENIMIENTO", "FUERA_DE_SERVICIO"].includes(h.room_status),
      );
    }
    return habitaciones.filter((h) => h.room_status === filtro);
  }, [habitaciones, filtro]);

  const pendientesPostCheckout = habitaciones.filter((h) => h.pendiente_post_checkout).length;

  async function marcarLimpia(h: HabitacionTablero) {
    setProcesando(h.room_id);
    setAviso(null);
    setError(null);
    try {
      await api.post(`/housekeeping/habitaciones/${h.room_id}/limpia`, {});
      setAviso(`Habitación ${h.room_number} lista para vender.`);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo marcar la habitación como limpia.");
    } finally {
      setProcesando(null);
    }
  }

  async function finalizar(maintenanceId: number, roomNumber: string, roomId: number) {
    setProcesando(roomId);
    setAviso(null);
    setError(null);
    try {
      await api.patch(`/housekeeping/${maintenanceId}/finalizar`, {});
      setAviso(`Bloqueo de la habitación ${roomNumber} finalizado.`);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo finalizar el bloqueo.");
    } finally {
      setProcesando(null);
    }
  }

  const filtros: { valor: Filtro; etiqueta: string }[] = [
    { valor: "PENDIENTES", etiqueta: "Pendientes" },
    { valor: "TODAS", etiqueta: "Todas" },
    { valor: "DISPONIBLE", etiqueta: "Disponibles" },
    { valor: "OCUPADA", etiqueta: "Ocupadas" },
  ];

  return (
    <>
      <PageHeader
        titulo="Limpieza y Mantenimiento"
        descripcion="Estado de limpieza y mantenimiento de las habitaciones. Una habitación bloqueada no se ofrece en la búsqueda de disponibilidad."
      />

      {/* ---------- Resumen por estado ---------- */}
      {resumen && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {(Object.keys(ESTADO_UI) as EstadoHabitacion[]).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setFiltro(e)}
              className={cn(
                "rounded-xl border bg-white p-4 text-left shadow-card transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold",
                filtro === e ? "border-gold" : "border-line hover:border-gold/60",
              )}
            >
              <p className="text-[0.7rem] uppercase tracking-wide text-carbon/55">
                {ESTADO_UI[e].etiqueta}
              </p>
              <p className="mt-1 font-serif text-2xl text-carbon">{resumen[e]}</p>
            </button>
          ))}
        </div>
      )}

      {pendientesPostCheckout > 0 && (
        <div className="mb-6">
          <InfoBox tipo="regla" titulo="Pendientes del check-out:">
            {pendientesPostCheckout === 1
              ? "hay 1 habitación que salió del check-out y todavía no se limpió."
              : `hay ${pendientesPostCheckout} habitaciones que salieron del check-out y todavía no se limpiaron.`}{" "}
            Hasta que se marquen limpias no vuelven a estar disponibles.
          </InfoBox>
        </div>
      )}

      {aviso && (
        <div className="mb-4">
          <InfoBox tipo="exito">{aviso}</InfoBox>
        </div>
      )}
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

      {/* ---------- Formulario de bloqueo ---------- */}
      {bloqueando && (
        <div className="mb-6">
          <Card
            titulo={`Bloquear habitación ${bloqueando.room_number}`}
            descripcion={`${bloqueando.room_type_name} · estado actual: ${ESTADO_UI[bloqueando.room_status].etiqueta}`}
          >
            <BloqueoForm
              habitacion={bloqueando}
              onCancelar={() => setBloqueando(null)}
              onGuardado={async () => {
                setAviso(`Bloqueo registrado en la habitación ${bloqueando.room_number}.`);
                setBloqueando(null);
                await cargar();
              }}
            />
          </Card>
        </div>
      )}

      {/* ---------- Tablero ---------- */}
      <Card titulo="Habitaciones">
        <div className="mb-5 flex flex-wrap gap-2">
          {filtros.map((f) => (
            <Button
              key={f.valor}
              tamano="sm"
              variante={filtro === f.valor ? "primario" : "secundario"}
              onClick={() => setFiltro(f.valor)}
            >
              {f.etiqueta}
            </Button>
          ))}
        </div>

        {cargando ? (
          <p className="py-10 text-center text-sm text-carbon/50">Cargando habitaciones…</p>
        ) : visibles.length === 0 ? (
          <EmptyState
            titulo={filtro === "PENDIENTES" ? "No hay tareas pendientes" : "No hay habitaciones para mostrar"}
            descripcion={
              filtro === "PENDIENTES"
                ? "Todas las habitaciones están disponibles u ocupadas."
                : "Ninguna habitación coincide con el filtro elegido."
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibles.map((h) => {
              const ui = ESTADO_UI[h.room_status];
              const bloqueo = h.bloqueo_vigente;
              const ocupado = procesando === h.room_id;

              return (
                <div
                  key={h.room_id}
                  className={cn(
                    "rounded-lg border bg-white p-4",
                    h.pendiente_post_checkout ? "border-warning/50" : "border-line",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-serif text-lg text-carbon">Hab. {h.room_number}</p>
                      <p className="text-xs text-carbon/55">
                        {h.room_type_name}
                        {h.floor_number !== null ? ` · Piso ${h.floor_number}` : ""}
                      </p>
                    </div>
                    <Badge tono={ui.tono}>{ui.etiqueta}</Badge>
                  </div>

                  {bloqueo && (
                    <div className="mt-3 rounded-md bg-bone/60 p-2 text-xs text-carbon/70">
                      <p className="font-medium">{TIPO_BLOQUEO_UI[bloqueo.maintenance_type].etiqueta}</p>
                      <p>{bloqueo.reason}</p>
                      <p className="text-carbon/50">
                        {fecha(bloqueo.start_date)} → {fecha(bloqueo.estimated_end_date)}
                      </p>
                    </div>
                  )}

                  {h.pendiente_post_checkout && (
                    <p className="mt-3 text-xs text-warning">Salió del check-out: pendiente de limpieza.</p>
                  )}

                  {h.bloqueos_programados.length > 0 && (
                    <p className="mt-2 text-xs text-carbon/50">
                      Programado: {TIPO_BLOQUEO_UI[h.bloqueos_programados[0].maintenance_type].etiqueta.toLowerCase()} desde el{" "}
                      {fecha(h.bloqueos_programados[0].start_date)}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {h.room_status === "LIMPIEZA" && (
                      <Button tamano="sm" cargando={ocupado} onClick={() => marcarLimpia(h)}>
                        Marcar limpia
                      </Button>
                    )}

                    {bloqueo && bloqueo.maintenance_type !== "LIMPIEZA" && (
                      <Button
                        tamano="sm"
                        cargando={ocupado}
                        onClick={() => finalizar(bloqueo.maintenance_id, h.room_number, h.room_id)}
                      >
                        Finalizar
                      </Button>
                    )}

                    {h.room_status !== "FUERA_DE_SERVICIO" && (
                      <Button tamano="sm" variante="secundario" onClick={() => setBloqueando(h)}>
                        {h.room_status === "OCUPADA" ? "Programar" : "Bloquear"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ---------- Bloqueos abiertos ---------- */}
      <div className="mt-6">
        <Card
          titulo="Bloqueos abiertos"
          descripcion="Incluye los programados a futuro. Los atrasados superaron su fecha estimada de finalización."
        >
          {abiertos.length === 0 ? (
            <p className="py-6 text-center text-sm text-carbon/45">No hay bloqueos abiertos.</p>
          ) : (
            <Table>
              <THead>
                <TH>Habitación</TH>
                <TH>Tipo</TH>
                <TH>Motivo</TH>
                <TH>Desde</TH>
                <TH>Hasta (est.)</TH>
                <TH>Registró</TH>
              </THead>
              <TBody>
                {abiertos.map((b) => {
                  const atrasado = new Date(b.estimated_end_date) < new Date(new Date().toDateString());
                  return (
                    <TR key={b.maintenance_id}>
                      <TD className="font-medium">{b.room.room_number}</TD>
                      <TD>
                        <Badge tono="alerta">{TIPO_BLOQUEO_UI[b.maintenance_type].etiqueta}</Badge>
                      </TD>
                      <TD className="text-xs">{b.reason}</TD>
                      <TD className="text-xs">{fecha(b.start_date)}</TD>
                      <TD className="text-xs">
                        {fecha(b.estimated_end_date)}
                        {atrasado && (
                          <span className="ml-1 text-[10px] font-semibold uppercase text-danger">atrasado</span>
                        )}
                      </TD>
                      <TD className="text-xs">
                        {b.employee_opened.employees_name} {b.employee_opened.employees_lastname}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
