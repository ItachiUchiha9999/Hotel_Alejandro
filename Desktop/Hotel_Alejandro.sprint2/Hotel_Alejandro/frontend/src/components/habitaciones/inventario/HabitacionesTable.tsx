"use client";

import {
  Badge,
  EmptyState,
  Select,
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

interface HabitacionesTablaProps {
  habitaciones: Habitacion[];

  /** Cambia el estado operativo de una habitación. */
  onAlternarEstado: (
    habitacion: Habitacion,
    nuevoEstado: EstadoHabitacion
  ) => void | Promise<void>;
}

/**
 * Tabla del inventario de habitaciones.
 */
export function HabitacionesTabla({
  habitaciones,
  onAlternarEstado,
}: HabitacionesTablaProps) {
  if (habitaciones.length === 0) {
    return (
      <EmptyState
        titulo="Todavía no hay habitaciones registradas"
        descripcion="Registrá la primera desde el formulario: indicá su número y elegí un tipo del catálogo."
      />
    );
  }

  return (
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

          <TH className="w-[42%] bg-carbon/5 text-xs uppercase text-carbon/60">
            Estado
          </TH>
        </THead>

        <TBody>
          {habitaciones.map((hab) => {
            const tipoActivo = hab.room_type.room_type_state;

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
                    <span className="max-w-full truncate">
                      {hab.room_type.room_type_name}
                    </span>

                    {!tipoActivo && (
                      <Badge tono="inactivo">
                        Tipo inactivo
                      </Badge>
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
                <TD className="min-w-0">
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_12rem] items-center gap-3">
                    {/* Badge */}
                    <div className="min-w-0">
                      <div className="flex flex-col items-start gap-1">
                        <Badge tono={TONO_ESTADO[hab.room_state]}>
                          {ETIQUETA_ESTADO[hab.room_state]}
                        </Badge>

                        {!tipoActivo && (
                          <span className="text-xs text-carbon/50">
                            Tipo de habitación inactivo
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Selector */}
                    <Select
                      aria-label={`Cambiar estado de la habitación ${hab.room_number}`}
                      value={hab.room_state}
                      className="w-full min-w-0"
                      disabled={!tipoActivo}
                      onChange={(e) =>
                        onAlternarEstado(
                          hab,
                          e.target.value as EstadoHabitacion
                        )
                      }
                    >
                      {(
                        Object.keys(
                          ETIQUETA_ESTADO
                        ) as EstadoHabitacion[]
                      ).map((estado) => (
                        <option
                          key={estado}
                          value={estado}
                        >
                          {ETIQUETA_ESTADO[estado]}
                        </option>
                      ))}
                    </Select>
                  </div>
                </TD>
              </tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}