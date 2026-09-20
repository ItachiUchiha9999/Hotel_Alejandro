"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, InfoBox } from "@/components/ui";
import { TipoHabitacionForm } from "@/components/habitaciones/TipoHabitacionForm";
import { api, ApiError } from "@/lib/api";
import type { TipoHabitacion } from "@/lib/types";

export default function EditarTipoHabitacionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;

  const [tipo, setTipo] = useState<TipoHabitacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cargarTipo = async () => {
      try {
        const data = await api.get<TipoHabitacion>(
          `/tipos-habitacion/${id}`
        );

        setTipo(data);
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "No se pudo cargar la información del tipo de habitación."
        );
      } finally {
        setCargando(false);
      }
    };

    if (id) {
      cargarTipo();
    }
  }, [id]);

  if (cargando) {
    return (
      <div className="py-12 text-center text-sm text-carbon/50">
        Cargando datos del tipo de habitación...
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full w-full pb-10">
      <PageHeader
        eyebrow="HAB-03 · Sprint 3"
        titulo={`Editar ${tipo?.room_type_name ?? "tipo de habitación"}`}
        descripcion="Modificá los datos y guardá para actualizar el catálogo."
      />

      <div className="w-full max-w-4xl mx-auto mt-6">
        <Card>
          {error ? (
            <InfoBox tipo="error">
              {error}
            </InfoBox>
          ) : (
            <TipoHabitacionForm
              tipo={tipo}
              onGuardado={() => {
                router.push("/habitaciones/tipos");
              }}
              onCancelar={() => {
                router.push("/habitaciones/tipos");
              }}
            />
          )}
        </Card>
      </div>
    </div>
  );
}