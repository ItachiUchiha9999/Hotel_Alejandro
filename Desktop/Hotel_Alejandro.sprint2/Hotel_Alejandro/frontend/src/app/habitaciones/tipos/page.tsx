"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { TipoHabitacionForm } from "@/components/habitaciones/TipoHabitacionForm";
import { Badge, Button, Card, EmptyState, InfoBox, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { TipoHabitacion } from "@/lib/types";

/** HAB-03 · ABM de tipos de habitación. */
export default function TiposHabitacionPage() {
  const [tipos, setTipos] = useState<TipoHabitacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editando, setEditando] = useState<TipoHabitacion | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setTipos(await api.get<TipoHabitacion[]>("/tipos-habitacion"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los tipos de habitación.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function alGuardar(mensaje: string) {
    setAviso(mensaje);
    setEditando(null);
    await cargar();
  }

  async function alternarEstado(tipo: TipoHabitacion) {
    setAviso(null);
    setError(null);
    try {
      await api.patch(`/tipos-habitacion/${tipo.room_type_id}/estado`, { estado: !tipo.room_type_state });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar el estado.");
    }
  }

  async function eliminar(tipo: TipoHabitacion) {
    if (!window.confirm(`¿Eliminar el tipo "${tipo.room_type_name}"? Esta acción no se puede deshacer.`)) return;
    setAviso(null);
    setError(null);
    try {
      await api.delete(`/tipos-habitacion/${tipo.room_type_id}`);
      if (editando?.room_type_id === tipo.room_type_id) setEditando(null);
      setAviso("Tipo de habitación eliminado.");
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo eliminar el tipo de habitación.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="HAB-03 · Sprint 3"
        titulo="Tipos de habitación"
        descripcion="Estandarizá la oferta de alojamiento del hotel y agrupá el inventario por tipo."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
        {/* Tabla — fracción mayor */}
        <Card titulo="Catálogo de tipos">
          {aviso && <InfoBox tipo="exito">{aviso}</InfoBox>}
          {error && <InfoBox tipo="error">{error}</InfoBox>}

          {cargando ? (
            <p className="py-10 text-center text-sm text-carbon/50">Cargando tipos de habitación…</p>
          ) : tipos.length === 0 ? (
            <EmptyState
              titulo="Todavía no hay tipos de habitación"
              descripcion="Creá el primero desde el formulario (por ejemplo Simple, Doble o Suite)."
            />
          ) : (
            <Table>
              <THead>
                <TH>Tipo</TH>
                <TH className="text-center">Capacidad</TH>
                <TH className="text-center">Habitaciones</TH>
                <TH>Estado</TH>
                <TH className="text-right">Acciones</TH>
              </THead>
              <TBody>
                {tipos.map((t) => (
                  <TR key={t.room_type_id}>
                    <TD>
                      <p className="font-medium">{t.room_type_name}</p>
                      {t.room_type_description && (
                        <p className="mt-0.5 text-xs text-carbon/50">{t.room_type_description}</p>
                      )}
                    </TD>
                    <TD className="text-center">{t.room_type_max_capacity}</TD>
                    <TD className="text-center">{t.rooms_count}</TD>
                    <TD>
                      <Badge tono={t.room_type_state ? "activo" : "inactivo"}>
                        {t.room_type_state ? "Activo" : "Inactivo"}
                      </Badge>
                    </TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button tamano="sm" variante="secundario" onClick={() => setEditando(t)}>
                          Editar
                        </Button>
                        <Button
                          tamano="sm"
                          variante={t.room_type_state ? "peligro" : "secundario"}
                          onClick={() => alternarEstado(t)}
                        >
                          {t.room_type_state ? "Desactivar" : "Activar"}
                        </Button>
                        <Button
                          tamano="sm"
                          variante="peligro"
                          disabled={t.rooms_count > 0}
                          title={
                            t.rooms_count > 0
                              ? "No se puede eliminar: tiene habitaciones asociadas"
                              : "Eliminar tipo"
                          }
                          onClick={() => eliminar(t)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        {/* Formulario — fracción menor, acompaña el scroll */}
        <Card
          titulo={editando ? `Editar "${editando.room_type_name}"` : "Nuevo tipo de habitación"}
          className="xl:sticky xl:top-6 xl:self-start"
        >
          <TipoHabitacionForm
            key={editando?.room_type_id ?? "nuevo"}
            tipo={editando}
            onGuardado={alGuardar}
            onCancelar={() => setEditando(null)}
          />
        </Card>
      </div>
    </>
  );
}
