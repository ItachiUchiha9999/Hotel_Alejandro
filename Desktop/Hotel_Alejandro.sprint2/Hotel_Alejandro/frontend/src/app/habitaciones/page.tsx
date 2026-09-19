"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { HabitacionForm } from "@/components/habitaciones/HabitacionForm";
import { Badge, Button, Card, EmptyState, InfoBox, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { EstadoHabitacion, Habitacion, TipoHabitacion } from "@/lib/types";

const ESTADO_ETIQUETA: Record<EstadoHabitacion, string> = {
  DISPONIBLE: "Disponible",
  OCUPADA: "Ocupada",
  MANTENIMIENTO: "Mantenimiento/Limpieza",
};

const ESTADO_TONO: Record<EstadoHabitacion, "activo" | "info" | "alerta"> = {
  DISPONIBLE: "activo",
  OCUPADA: "info",
  MANTENIMIENTO: "alerta",
};

/** HAB-01 · Registro e inventario de habitaciones. */
export default function HabitacionesPage() {
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [tipos, setTipos] = useState<TipoHabitacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editando, setEditando] = useState<Habitacion | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [hab, tip] = await Promise.all([
        api.get<Habitacion[]>("/habitaciones"),
        api.get<TipoHabitacion[]>("/tipos-habitacion"),
      ]);
      // "2" antes que "10": el orden del backend es alfabético, acá se ordena como número.
      hab.sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, { numeric: true }));
      setHabitaciones(hab);
      setTipos(tip);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar las habitaciones.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const sinTiposActivos = !cargando && !tipos.some((t) => t.room_type_state);

  // Solo tipos activos; al editar se conserva además el tipo actual de la habitación.
  const tiposSeleccionables = useMemo(
    () => tipos.filter((t) => t.room_type_state || t.room_type_id === editando?.room_type_id),
    [tipos, editando],
  );

  async function alGuardar(mensaje: string) {
    setAviso(mensaje);
    setEditando(null);
    await cargar();
  }

  return (
    <>
      <PageHeader
        eyebrow="HAB-01 · Sprint 3"
        titulo="Inventario de habitaciones"
        descripcion="Conformá el inventario físico del hotel: cada habitación con su número único, su tipo y su estado."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
        {/* Tabla — fracción mayor */}
        <Card titulo="Habitaciones registradas">
          {aviso && <InfoBox tipo="exito">{aviso}</InfoBox>}
          {error && <InfoBox tipo="error">{error}</InfoBox>}

          {cargando ? (
            <p className="py-10 text-center text-sm text-carbon/50">Cargando habitaciones…</p>
          ) : habitaciones.length === 0 ? (
            <EmptyState
              titulo="Todavía no hay habitaciones registradas"
              descripcion="Registrá la primera desde el formulario. Necesitás al menos un tipo de habitación activo."
            />
          ) : (
            <Table>
              <THead>
                <TH>Número</TH>
                <TH>Tipo</TH>
                <TH className="text-center">Capacidad</TH>
                <TH>Estado</TH>
                <TH className="text-right">Acciones</TH>
              </THead>
              <TBody>
                {habitaciones.map((h) => (
                  <TR key={h.room_id}>
                    <TD className="font-medium">{h.room_number}</TD>
                    <TD>
                      {h.room_type.room_type_name}
                      {!h.room_type.room_type_state && (
                        <span className="ml-2 text-xs text-carbon/50">(tipo inactivo)</span>
                      )}
                    </TD>
                    <TD className="text-center">{h.room_type.room_type_max_capacity}</TD>
                    <TD>
                      <Badge tono={ESTADO_TONO[h.room_state]}>{ESTADO_ETIQUETA[h.room_state]}</Badge>
                    </TD>
                    <TD className="text-right">
                      <Button tamano="sm" variante="secundario" onClick={() => setEditando(h)}>
                        Editar
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        {/* Formulario — fracción menor, acompaña el scroll */}
        <Card
          titulo={editando ? `Editar habitación ${editando.room_number}` : "Nueva habitación"}
          className="xl:sticky xl:top-6 xl:self-start"
        >
          <HabitacionForm
            key={editando?.room_id ?? "nuevo"}
            habitacion={editando}
            tipos={tiposSeleccionables}
            sinTiposActivos={sinTiposActivos}
            onGuardado={alGuardar}
            onCancelar={() => setEditando(null)}
          />
        </Card>
      </div>
    </>
  );
}
