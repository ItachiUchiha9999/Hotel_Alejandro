"use client";

import {
  Badge,
  Button,
  EmptyState,
  Table,
  TBody,
  TD,
  TH,
  THead,
} from "@/components/ui";

import type { TipoHabitacion } from "@/lib/types";

interface TiposHabitacionTableProps {
  tipos: TipoHabitacion[];
  /** Tipo que se está editando en el formulario, para resaltar su fila. */
  editandoId: number | null;
  /** Tipo cuyo estado se está cambiando en este momento. */
  procesandoId: number | null;
  onEditar: (tipo: TipoHabitacion) => void;
  onCambiarEstado: (tipo: TipoHabitacion) => void;
}

/** Tabla del catálogo de tipos de habitación (HAB-03). */
export function TiposHabitacionTable({
  tipos,
  editandoId,
  procesandoId,
  onEditar,
  onCambiarEstado,
}: TiposHabitacionTableProps) {
  if (tipos.length === 0) {
    return (
      <EmptyState
        titulo="Todavía no hay tipos de habitación"
        descripcion="Cargá el primero desde el formulario, por ejemplo Simple, Doble o Suite."
      />
    );
  }

  return (
    <Table className="w-full table-fixed">
      <THead>
        <TH className="w-[24%] bg-carbon/5 text-xs uppercase text-carbon/60">
          Tipo
        </TH>

        <TH className="w-[17%] bg-carbon/5 text-xs uppercase text-carbon/60">
          Capacidad
        </TH>

        <TH className="w-[17%] bg-carbon/5 text-xs uppercase text-carbon/60">
          <div className="flex w-full justify-center">
            Habitaciones
          </div>
        </TH>

        <TH className="w-[22%] bg-carbon/5 text-xs uppercase text-carbon/60">
          Estado
        </TH>

        <TH className="w-[20%] bg-carbon/5 text-xs uppercase text-carbon/60">
          <span className="sr-only">Acciones</span>
        </TH>
      </THead>

      <TBody>
        {tipos.map((tipo) => (
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
              {tipo.room_type_max_capacity === 1
                ? "persona"
                : "personas"}
            </TD>

            {/* Habitaciones */}
            <TD>
              <div className="flex w-full justify-center">
                {tipo.rooms_count}
              </div>
            </TD>

            {/* Estado */}
            <TD>
              <Badge
                tono={tipo.room_type_state ? "activo" : "inactivo"}
              >
                {tipo.room_type_state ? "Activo" : "Inactivo"}
              </Badge>
            </TD>

            
            {/* Acciones */}
            <TD className="w-[20%] p-0">
              <div className="flex w-full items-center justify-center gap-4">
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
  );
}