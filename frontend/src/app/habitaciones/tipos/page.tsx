"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, InfoBox, EmptyState } from "@/components/ui";
import { TiposHabitacionTable } from "@/components/habitaciones/TiposHabitacionTable";
import { api, ApiError } from "@/lib/api";
import type { TipoHabitacion } from "@/lib/types";
import Link from "next/link";
import { Plus } from "lucide-react";

export default function TiposHabitacionPage() {
  const router = useRouter();
  const [tipos, setTipos] = useState<TipoHabitacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setTipos(await api.get<TipoHabitacion[]>("/tipos-habitacion"));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los tipos de habitación.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function alternarEstado(tipo: TipoHabitacion) {
    setAviso(null);
    try {
      // Validamos si viene como room_type_state o active desde el backend
      const estadoActual = tipo.room_type_state !== undefined ? tipo.room_type_state : tipo.active;
      
      await api.patch(`/tipos-habitacion/${tipo.room_type_id}/estado`, { estado: !estadoActual });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar el estado.");
    }
  }

  return (
    <div className="flex flex-col min-h-full w-full">
      <PageHeader
        eyebrow=""
        titulo="Tipos de habitación"
        descripcion=""
      />

      {(error || aviso) && (
        <div className="mb-5 flex flex-col gap-3">
          {error && <InfoBox tipo="error">{error}</InfoBox>}
          {aviso && <InfoBox tipo="exito">{aviso}</InfoBox>}
        </div>
      )}

      <div className="flex justify-end mb-6 mt-4">
        <Link 
          href="/habitaciones/tipos/nuevo" 
          className="flex items-center gap-2 px-4 py-2 bg-gold hover:bg-gold-dark text-carbon font-semibold rounded-md text-sm transition-colors shadow-sm"
        >
          <Plus size={16} />
          Nuevo tipo de habitación
        </Link>
      </div>

      <div className="w-full">
        <Card titulo="Tipos definidos" descripcion="Un tipo inactivo no se ofrece al registrar nuevas habitaciones.">
          {cargando ? (
            <p className="py-10 text-center text-sm text-carbon/50">Cargando catálogo…</p>
          ) : tipos.length === 0 ? (
            <EmptyState
              titulo="Todavía no hay tipos de habitación"
              descripcion="Registrá el primero haciendo clic en el botón superior."
            />
          ) : (
            <TiposHabitacionTable
              tipos={tipos}
              editandoId={null}
              procesandoId={null}
              onEditar={(tipo) => router.push(`/habitaciones/tipos/${tipo.room_type_id}`)}
              onCambiarEstado={alternarEstado}
            />
          )}
        </Card>
      </div>
    </div>
  );
}