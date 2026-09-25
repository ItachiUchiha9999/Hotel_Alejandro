"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FieldGrid,
  InfoBox,
  Input,
  Select,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";

interface TipoHabitacionCatalogo {
  room_type_id: number;
  room_type_name: string;
  room_type_max_capacity: number;
  room_type_state: boolean;
}

interface HabitacionDisponible {
  room_id: number;
  room_number: string;
  room_state: string;
  room_type: {
    room_type_id: number;
    name: string;
    description: string | null;
    max_capacity: number;
  };
  noches: number;
  precio_por_noche: number;
  precio_total_estimado: number;
}

interface RespuestaDisponibilidad {
  filtros: {
    desde: string;
    hasta: string;
    noches: number;
    capacidad_solicitada: number | null;
  };
  total_disponibles: number;
  habitaciones: HabitacionDisponible[];
}

const plata = (valor: number | string) =>
  Number(valor || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function ConsultaDisponibilidad() {
  const hoyStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const mananaStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  // Filtros obligatorios y opcionales
  const [desde, setDesde] = useState(hoyStr);
  const [hasta, setHasta] = useState(mananaStr);
  const [capacidad, setCapacidad] = useState("1");
  const [tipoId, setTipoId] = useState("");

  // Catálogo de tipos para el selector
  const [tipos, setTipos] = useState<TipoHabitacionCatalogo[]>([]);
  const [cargandoTipos, setCargandoTipos] = useState(true);

  // Estados de consulta y resultados
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<RespuestaDisponibilidad | null>(null);
  const [haBuscado, setHaBuscado] = useState(false);

  // Cargar catálogo de tipos de habitación
  useEffect(() => {
    const cargarCatalogo = async () => {
      try {
        const res = await api.get<any>("/tipos-habitacion");
        const data = Array.isArray(res) ? res : res?.data || [];
        setTipos(data.filter((t: TipoHabitacionCatalogo) => t.room_type_state));
      } catch {
        // Fallback silencioso si el catálogo falla
      } finally {
        setCargandoTipos(false);
      }
    };
    cargarCatalogo();
  }, []);

  const buscarDisponibilidad = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      setError(null);

      if (!desde || !hasta) {
        return setError("Las fechas de Check-in y Check-out son obligatorias.");
      }
      if (hasta <= desde) {
        return setError("La fecha de Check-out debe ser posterior a la de Check-in.");
      }

      setCargando(true);
      setHaBuscado(true);

      try {
        const params = new URLSearchParams({
          desde,
          hasta,
        });

        if (capacidad && Number(capacidad) > 0) {
          params.set("capacidad", capacidad);
        }
        if (tipoId) {
          params.set("tipo", tipoId);
        }

        const res = await api.get<any>(`/habitaciones/disponibilidad?${params.toString()}`);
        const data: RespuestaDisponibilidad = res?.data ?? res;
        setResultado(data);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "No se pudo consultar la disponibilidad de habitaciones."
        );
        setResultado(null);
      } finally {
        setCargando(false);
      }
    },
    [desde, hasta, capacidad, tipoId]
  );

  return (
    <div className="space-y-6">
      {/* PANEL DE FILTROS DE BÚSQUEDA */}
      <Card>
        <form onSubmit={buscarDisponibilidad} className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-carbon">
              Parámetros de consulta
            </h2>
            <p className="text-xs text-carbon/55">
              Consultá las habitaciones disponibles y calculá el presupuesto total según la estadía requerida.
            </p>
          </div>

          <FieldGrid>
            <Field label="Check-in (Fecha Desde)" htmlFor="desde" requerido>
              <Input
                id="desde"
                type="date"
                value={desde}
                min={hoyStr}
                onChange={(e) => {
                  setDesde(e.target.value);
                  if (hasta <= e.target.value) {
                    const next = new Date(`${e.target.value}T00:00:00`);
                    next.setDate(next.getDate() + 1);
                    setHasta(next.toISOString().slice(0, 10));
                  }
                }}
                disabled={cargando}
              />
            </Field>

            <Field label="Check-out (Fecha Hasta)" htmlFor="hasta" requerido>
              <Input
                id="hasta"
                type="date"
                value={hasta}
                min={desde || hoyStr}
                onChange={(e) => setHasta(e.target.value)}
                disabled={cargando}
              />
            </Field>

            <Field
              label="Huéspedes requeridos"
              htmlFor="capacidad"
              ayuda="Filtra tipos de habitación que soporten esta capacidad."
            >
              <Input
                id="capacidad"
                type="number"
                min="1"
                max="10"
                value={capacidad}
                onChange={(e) => setCapacidad(e.target.value)}
                disabled={cargando}
              />
            </Field>

            <Field
              label="Tipo de habitación"
              htmlFor="tipo"
              ayuda={cargandoTipos ? "Cargando catálogo..." : "Opcional"}
            >
              <Select
                id="tipo"
                value={tipoId}
                onChange={(e) => setTipoId(e.target.value)}
                disabled={cargando || cargandoTipos}
              >
                <option value="">Todos los tipos disponibles</option>
                {tipos.map((t) => (
                  <option key={t.room_type_id} value={t.room_type_id}>
                    {t.room_type_name} (Hasta {t.room_type_max_capacity} pers.)
                  </option>
                ))}
              </Select>
            </Field>
          </FieldGrid>

          {error && <InfoBox tipo="error">{error}</InfoBox>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="submit" cargando={cargando}>
              Consultar disponibilidad
            </Button>
          </div>
        </form>
      </Card>

      {/* RESULTADOS DE LA CONSULTA */}
      {cargando ? (
        <Card>
          <p className="py-12 text-center text-sm text-carbon/50">
            Consultando habitaciones disponibles y calculando tarifas...
          </p>
        </Card>
      ) : haBuscado && resultado ? (
        resultado.habitaciones.length === 0 ? (
          <Card>
            <EmptyState
              titulo="No hay habitaciones disponibles"
              descripcion="No se encontraron habitaciones en estado 'Disponible' que cumplan con la capacidad y rango de fechas especificados."
            />
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div>
                <h3 className="text-sm font-semibold text-carbon">
                  Opciones encontradas ({resultado.total_disponibles})
                </h3>
                <p className="text-xs text-carbon/55">
                  Estadía calculada para <strong>{resultado.filtros.noches} {resultado.filtros.noches === 1 ? "noche" : "noches"}</strong> (Check-in {resultado.filtros.desde} / Check-out {resultado.filtros.hasta}).
                </p>
              </div>
              <Badge tono="activo">
                {resultado.total_disponibles} {resultado.total_disponibles === 1 ? "Habitación disponible" : "Habitaciones disponibles"}
              </Badge>
            </div>

            {/* GRILLA DE TARJETAS DE HABITACIONES */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {resultado.habitaciones.map((hab) => (
                <div
                  key={hab.room_id}
                  className="flex flex-col justify-between rounded-xl border border-carbon/10 bg-white p-5 shadow-sm transition hover:border-carbon/25 hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon/45">
                          Habitación
                        </span>
                        <h4 className="font-mono text-2xl font-bold text-carbon">
                          {hab.room_number}
                        </h4>
                      </div>
                      <Badge tono="activo">{hab.room_state}</Badge>
                    </div>

                    <div className="rounded-lg bg-carbon/[0.025] p-3 border border-carbon/5">
                      <p className="text-sm font-semibold text-carbon">
                        {hab.room_type.name}
                      </p>
                      <p className="mt-0.5 text-xs text-carbon/60">
                        Capacidad máx: <strong>{hab.room_type.max_capacity} huéspedes</strong>
                      </p>
                      {hab.room_type.description && (
                        <p className="mt-1 text-xs text-carbon/45 line-clamp-2">
                          {hab.room_type.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 space-y-3 border-t border-carbon/10 pt-4">
                    <div className="flex items-baseline justify-between text-xs text-carbon/65">
                      <span>Tarifa por noche:</span>
                      <span className="font-mono text-sm font-medium tabular-nums text-carbon">
                        $ {plata(hab.precio_por_noche)}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between rounded-lg bg-emerald-50/70 p-2.5 text-emerald-950">
                      <span className="text-xs font-semibold">
                        Total ({hab.noches} {hab.noches === 1 ? "noche" : "noches"}):
                      </span>
                      <span className="font-mono text-base font-bold tabular-nums text-emerald-800">
                        $ {plata(hab.precio_total_estimado)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}