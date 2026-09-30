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

import type { TipoHabitacion } from "@/lib/types";
import { asignarTarifaTipo, ApiError } from "@/lib/api";

interface TiposHabitacionTableProps {
  tipos: TipoHabitacion[];
  editandoId: number | null;
  procesandoId: number | null;
  onEditar: (tipo: TipoHabitacion) => void;
  onCambiarEstado: (tipo: TipoHabitacion) => void;
  onRecargar?: () => void;
}

/**
 * Tabla del catálogo de tipos de habitación (HAB-03, HAB-04, TAR-01).
 */
export function TiposHabitacionTable({
  tipos,
  editandoId,
  procesandoId,
  onEditar,
  onCambiarEstado,
  onRecargar,
}: TiposHabitacionTableProps) {
  const [filtroEstado, setFiltroEstado] = useState<"TODOS" | "ACTIVOS" | "INACTIVOS">("TODOS");
  const [modalTarifaTipo, setModalTarifaTipo] = useState<TipoHabitacion | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // HAB-04: Filtro por estado
  const tiposFiltrados = tipos.filter((t) => {
    if (filtroEstado === "ACTIVOS") return t.room_type_state === true;
    if (filtroEstado === "INACTIVOS") return t.room_type_state === false;
    return true;
  });

  return (
    <div className="space-y-4">
      {mensaje && <InfoBox tipo="exito">{mensaje}</InfoBox>}

      {/* Selector de filtros de estado (HAB-04) */}
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-carbon/60">Mostrar:</span>
          {(["TODOS", "ACTIVOS", "INACTIVOS"] as const).map((estado) => (
            <button
              key={estado}
              type="button"
              onClick={() => setFiltroEstado(estado)}
              className={
                filtroEstado === estado
                  ? "rounded-md bg-carbon px-3 py-1 text-xs font-medium text-bone shadow-sm"
                  : "rounded-md border border-line bg-white px-3 py-1 text-xs font-medium text-carbon/70 hover:bg-bone/40"
              }
            >
              {estado === "TODOS" ? "Todos" : estado === "ACTIVOS" ? "Activos" : "Inactivos"}
            </button>
          ))}
        </div>

        <span className="text-xs text-carbon/50">
          {tiposFiltrados.length} tipo(s) encontrado(s)
        </span>
      </div>

      {tiposFiltrados.length === 0 ? (
        <EmptyState
          titulo="No hay tipos con este filtro"
          descripcion="No se encontraron tipos de habitación para el estado seleccionado."
        />
      ) : (
        <Table className="w-full table-fixed">
          <THead>
            <TH className="w-[20%] bg-carbon/5 text-xs uppercase text-carbon/60">
              Tipo
            </TH>
            <TH className="w-[12%] bg-carbon/5 text-xs uppercase text-carbon/60">
              Capacidad
            </TH>
            <TH className="w-[18%] bg-carbon/5 text-xs uppercase text-carbon/60">
              Precio base / noche
            </TH>
            <TH className="w-[15%] bg-carbon/5 text-center text-xs uppercase text-carbon/60">
              Habitaciones activas
            </TH>
            <TH className="w-[12%] bg-carbon/5 text-xs uppercase text-carbon/60">
              Estado
            </TH>
            <TH className="w-[23%] bg-carbon/5 text-right text-xs uppercase text-carbon/60">
              Acciones
            </TH>
          </THead>

          <TBody>
            {tiposFiltrados.map((tipo) => (
              <tr
                key={tipo.room_type_id}
                className={
                  "border-b border-line transition-colors hover:bg-bone/40" +
                  (tipo.room_type_id === editandoId ? " bg-gold/10" : "")
                }
              >
                {/* Tipo */}
                <TD>
                  <p className="font-medium text-carbon">
                    {tipo.room_type_name}
                  </p>
                  {tipo.room_type_description && (
                    <p className="mt-0.5 max-w-xs text-xs text-carbon/60">
                      {tipo.room_type_description}
                    </p>
                  )}
                </TD>

                {/* Capacidad */}
                <TD>
                  {tipo.room_type_max_capacity}{" "}
                  {tipo.room_type_max_capacity === 1 ? "persona" : "personas"}
                </TD>

                {/* Tarifa vigente (TAR-01) */}
                <TD className="font-medium text-carbon">
                  {tipo.current_price == null ? (
                    <span className="text-xs italic text-carbon/40">Sin tarifa</span>
                  ) : (
                    Number(tipo.current_price).toLocaleString("es-AR", {
                      style: "currency",
                      currency: tipo.current_currency ?? "ARS",
                      maximumFractionDigits: 2,
                    })
                  )}
                </TD>

                {/* Habitaciones activas asociadas (HAB-04) */}
                <TD>
                  <div className="flex w-full justify-center font-medium">
                    {tipo.rooms_count}
                  </div>
                </TD>

                {/* Estado */}
                <TD>
                  <Badge tono={tipo.room_type_state ? "activo" : "inactivo"}>
                    {tipo.room_type_state ? "Activo" : "Inactivo"}
                  </Badge>
                </TD>

                {/* Acciones */}
                <TD className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variante="secundario"
                      tamano="sm"
                      onClick={() => {
                        setMensaje(null);
                        setModalTarifaTipo(tipo);
                      }}
                    >
                      Tarifa
                    </Button>

                    <Button
                      variante="secundario"
                      tamano="sm"
                      onClick={() => onEditar(tipo)}
                    >
                      Editar
                    </Button>

                    <Button
                      variante="fantasma"
                      tamano="sm"
                      cargando={procesandoId === tipo.room_type_id}
                      onClick={() => onCambiarEstado(tipo)}
                    >
                      {tipo.room_type_state ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                </TD>
              </tr>
            ))}
          </TBody>
        </Table>
      )}

      {/* Modal TAR-01: Asignar precio base por noche */}
      {modalTarifaTipo && (
        <ModalAsignarTarifa
          tipo={modalTarifaTipo}
          onCerrar={() => setModalTarifaTipo(null)}
          onExito={(msg) => {
            setModalTarifaTipo(null);
            setMensaje(msg);
            if (onRecargar) {
              onRecargar();
            } else {
              window.location.reload();
            }
          }}
        />
      )}
    </div>
  );
}

function ModalAsignarTarifa({
  tipo,
  onCerrar,
  onExito,
}: {
  tipo: TipoHabitacion;
  onCerrar: () => void;
  onExito: (msg: string) => void;
}) {
  const [precio, setPrecio] = useState(
    tipo.current_price != null ? String(tipo.current_price) : ""
  );
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const val = Number(precio);
    if (!Number.isFinite(val) || val <= 0) {
      setError("El precio ingresado debe ser mayor a cero.");
      return;
    }

    setError(null);
    setEnviando(true);
    try {
      await asignarTarifaTipo(tipo.room_type_id, {
        basePrice: val,
        reason: motivo.trim() || undefined,
      });
      onExito(`Tarifa base para ${tipo.room_type_name} actualizada correctamente.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al guardar la tarifa.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-carbon/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-line bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-serif text-lg text-carbon">
            Tarifa Base — {tipo.room_type_name}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-carbon/40 hover:bg-carbon/5"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && <InfoBox tipo="error">{error}</InfoBox>}

          <Field label="Precio base por noche (TAR-01)" htmlFor="tar-precio">
            <Input
              id="tar-precio"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Ej.: 45000"
              value={precio}
              disabled={enviando}
              onChange={(e) => setPrecio(e.target.value)}
            />
          </Field>

          <Field label="Moneda local" htmlFor="tar-moneda">
            <Input id="tar-moneda" type="text" value="ARS ($)" disabled readOnly />
          </Field>

          <Field
            label="Motivo del cambio (Historial)"
            htmlFor="tar-motivo"
            ayuda="Opcional. Queda guardado en la auditoría de tarifas."
          >
            <Input
              id="tar-motivo"
              placeholder="Ej.: Ajuste por temporada / Inflación"
              value={motivo}
              disabled={enviando}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </Field>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variante="secundario" onClick={onCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" cargando={enviando}>
              Guardar tarifa
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}