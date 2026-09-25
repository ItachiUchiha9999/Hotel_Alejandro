"use client";

import { useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  InfoBox,
  Table,
  TBody,
  TD,
  TH,
  THead,
} from "@/components/ui";

import {
  ETIQUETA_ESTADO,
  TONO_ESTADO,
} from "@/components/habitaciones/formato";

import type {
  EstadoHabitacion,
  Habitacion,
} from "@/lib/types";

import {
  registrarMantenimiento,
  cerrarMantenimiento,
  getMantenimientosActivos,
  ApiError,
} from "@/lib/api";

interface HabitacionesTablaProps {
  habitaciones: Habitacion[];
  onAlternarEstado?: (
    habitacion: Habitacion,
    nuevoEstado: EstadoHabitacion
  ) => void | Promise<void>;
  onRecargar?: () => void;
}

const leerEmployeeId = () => {
  if (typeof window === "undefined") return "1";
  return window.localStorage.getItem("employeeId") ?? "1";
};

export function HabitacionesTabla({
  habitaciones,
  onRecargar,
}: HabitacionesTablaProps) {
  const [bloquearHab, setBloquearHab] = useState<Habitacion | null>(null);
  const [cerrarHab, setCerrarHab] = useState<Habitacion | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  if (habitaciones.length === 0) {
    return (
      <EmptyState
        titulo="Todavía no hay habitaciones registradas"
        descripcion="Registrá la primera desde el formulario: indicá su número y elegí un tipo del catálogo."
      />
    );
  }

  const recargar = () => {
    if (onRecargar) {
      onRecargar();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="w-full space-y-4">
      {mensajeExito && (
        <InfoBox tipo="exito">
          {mensajeExito}
        </InfoBox>
      )}

      <div className="w-full overflow-x-auto">
        <Table className="w-full table-fixed">
          <THead>
            <TH className="w-[18%] bg-carbon/5 text-xs uppercase text-carbon/60">
              Habitación
            </TH>
            <TH className="w-[20%] bg-carbon/5 text-xs uppercase text-carbon/60">
              Tipo
            </TH>
            <TH className="w-[20%] bg-carbon/5 text-xs uppercase text-carbon/60">
              Capacidad
            </TH>
            <TH className="w-[18%] bg-carbon/5 text-xs uppercase text-carbon/60">
              Estado
            </TH>
            <TH className="w-[24%] bg-carbon/5 text-right text-xs uppercase text-carbon/60">
              Acciones 
            </TH>
          </THead>

          <TBody>
            {habitaciones.map((hab) => {
              const tipoActivo = hab.room_type.room_type_state;
              const enMantenimientoOLimpieza =
                hab.room_state === "MANTENIMIENTO" ||
                hab.room_state === "LIMPIEZA" ||
                (hab.room_state as string) === "FUERA_DE_SERVICIO";

              return (
                <tr
                  key={hab.room_id}
                  className="border-b border-line transition-colors hover:bg-bone/40"
                >
                  {/* Habitación */}
                  <TD className="font-medium text-carbon">
                    {hab.room_number}
                  </TD>

                  {/* Tipo */}
                  <TD>
                    <div className="flex min-w-0 flex-col items-start gap-1">
                      <span className="max-w-full truncate font-medium">
                        {hab.room_type.room_type_name}
                      </span>
                      {!tipoActivo && (
                        <Badge tono="inactivo">Tipo inactivo</Badge>
                      )}
                    </div>
                  </TD>

                  {/* Capacidad */}
                  <TD className="whitespace-nowrap">
                    {hab.room_type.room_type_max_capacity}{" "}
                    {hab.room_type.room_type_max_capacity === 1
                      ? "persona"
                      : "personas"}
                  </TD>

                  {/* Estado */}
                  <TD>
                    <Badge tono={TONO_ESTADO[hab.room_state]}>
                      {ETIQUETA_ESTADO[hab.room_state] ?? hab.room_state}
                    </Badge>
                  </TD>

                  {/* Acciones */}
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {enMantenimientoOLimpieza ? (
                        <Button
                          tamano="sm"
                          variante="secundario"
                          onClick={() => {
                            setMensajeExito(null);
                            setCerrarHab(hab);
                          }}
                        >
                          Cerrar mantenimiento
                        </Button>
                      ) : hab.room_state === "DISPONIBLE" ? (
                        <Button
                          tamano="sm"
                          variante="secundario"
                          disabled={!tipoActivo}
                          onClick={() => {
                            setMensajeExito(null);
                            setBloquearHab(hab);
                          }}
                        >
                          Bloquear / Trabajos
                        </Button>
                      ) : (
                        <span className="text-xs text-carbon/40 italic">
                          Ocupada por huésped
                        </span>
                      )}
                    </div>
                  </TD>
                </tr>
              );
            })}
          </TBody>
        </Table>
      </div>

      {/* Modal para Registrar Bloqueo (HAB-06) */}
      {bloquearHab && (
        <ModalRegistrarBloqueo
          habitacion={bloquearHab}
          onCerrar={() => setBloquearHab(null)}
          onExito={(msg) => {
            setBloquearHab(null);
            setMensajeExito(msg);
            recargar();
          }}
        />
      )}

      {/* Modal para Cerrar Mantenimiento (HAB-06) */}
      {cerrarHab && (
        <ModalCerrarBloqueo
          habitacion={cerrarHab}
          onCerrar={() => setCerrarHab(null)}
          onExito={(msg) => {
            setCerrarHab(null);
            setMensajeExito(msg);
            recargar();
          }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Modal de Registro de Bloqueo
 * ------------------------------------------------------------------------- */
function ModalRegistrarBloqueo({
  habitacion,
  onCerrar,
  onExito,
}: {
  habitacion: Habitacion;
  onCerrar: () => void;
  onExito: (mensaje: string) => void;
}) {
  const hoyStr = new Date().toISOString().slice(0, 10);
  const mananaStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const [tipo, setTipo] = useState<"MANTENIMIENTO" | "LIMPIEZA" | "FUERA_DE_SERVICIO">("MANTENIMIENTO");
  const [fechaInicio, setFechaInicio] = useState(hoyStr);
  const [fechaFin, setFechaFin] = useState(mananaStr);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) {
      setError("El motivo del trabajo es obligatorio.");
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await registrarMantenimiento({
        roomId: habitacion.room_id,
        tipo,
        fechaInicio,
        fechaFinEstimada: fechaFin,
        motivo: motivo.trim(),
        employeeId: leerEmployeeId(),
      });
      onExito(`Habitación ${habitacion.room_number} bloqueada por ${tipo.toLowerCase()} correctamente.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al registrar el bloqueo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ModalShell titulo={`Bloqueo de Habitación ${habitacion.room_number}`} onCerrar={onCerrar}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <InfoBox tipo="error">{error}</InfoBox>}

        <Field label="Tipo de trabajo" htmlFor="tipo-bloqueo">
          <select
            id="tipo-bloqueo"
            value={tipo}
            disabled={enviando}
            onChange={(e) => setTipo(e.target.value as any)}
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-carbon focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/60"
          >
            <option value="MANTENIMIENTO">Mantenimiento (reparaciones, albañilería, etc.)</option>
            <option value="LIMPIEZA">Limpieza profunda / Desinfección</option>
            <option value="FUERA_DE_SERVICIO">Fuera de servicio</option>
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Fecha de inicio" htmlFor="fecha-inicio">
            <Input
              id="fecha-inicio"
              type="date"
              value={fechaInicio}
              disabled={enviando}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </Field>
          <Field label="Fin estimado" htmlFor="fecha-fin">
            <Input
              id="fecha-fin"
              type="date"
              value={fechaFin}
              disabled={enviando}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Motivo del trabajo" htmlFor="motivo-bloqueo" ayuda="Obligatorio.">
          <textarea
            id="motivo-bloqueo"
            rows={3}
            placeholder="Ej.: Reparación de pérdida en baño / Pintura"
            value={motivo}
            disabled={enviando}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-carbon focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/60"
          />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" cargando={enviando}>
            Confirmar bloqueo
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

/* ---------------------------------------------------------------------------
 * Modal de Cierre de Bloqueo
 * ------------------------------------------------------------------------- */
function ModalCerrarBloqueo({
  habitacion,
  onCerrar,
  onExito,
}: {
  habitacion: Habitacion;
  onCerrar: () => void;
  onExito: (mensaje: string) => void;
}) {
  const hoyStr = new Date().toISOString().slice(0, 10);
  const [fechaFinReal, setFechaFinReal] = useState(hoyStr);
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const abiertos = await getMantenimientosActivos(habitacion.room_id);
      if (!abiertos || abiertos.length === 0) {
        throw new Error("No se encontró ningún registro de mantenimiento abierto para esta habitación.");
      }
      const actualId = abiertos[0].maintenance_id;
      await cerrarMantenimiento(actualId, {
        fechaFinReal,
        notasCierre: notas.trim() || undefined,
        employeeId: leerEmployeeId(),
      });
      onExito(`Mantenimiento cerrado. Habitación ${habitacion.room_number} vuelve a estar DISPONIBLE.`);
    } catch (err: any) {
      setError(err?.message ?? "Error al cerrar el mantenimiento.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ModalShell titulo={`Finalizar Trabajos — Habitación ${habitacion.room_number}`} onCerrar={onCerrar}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <InfoBox tipo="error">{error}</InfoBox>}

        <p className="text-sm text-carbon/75">
          Al confirmar, el bloqueo se dará por concluido y la habitación volverá a quedar habilitada como <strong>DISPONIBLE</strong>.
        </p>

        <Field label="Fecha de finalización real" htmlFor="fecha-real">
          <Input
            id="fecha-real"
            type="date"
            value={fechaFinReal}
            disabled={enviando}
            onChange={(e) => setFechaFinReal(e.target.value)}
          />
        </Field>

        <Field label="Notas de cierre" htmlFor="notas-cierre" ayuda="Opcional.">
          <textarea
            id="notas-cierre"
            rows={3}
            placeholder="Ej.: Trabajo concluido y verificado por housekeeping."
            value={notas}
            disabled={enviando}
            onChange={(e) => setNotas(e.target.value)}
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-carbon focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/60"
          />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" cargando={enviando}>
            Habilitar habitación
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

/* ---------------------------------------------------------------------------
 * Envoltorio Modal
 * ------------------------------------------------------------------------- */
function ModalShell({
  titulo,
  onCerrar,
  children,
}: {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-carbon/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-line bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-serif text-lg text-carbon">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-carbon/40 hover:bg-carbon/5"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}