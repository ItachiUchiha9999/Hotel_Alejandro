"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, InfoBox } from "@/components/ui";
import { HabitacionForm } from "../../../components/habitaciones/inventario/HabitacionForm";
import { api, ApiError } from "@/lib/api";
import type { TipoHabitacion } from "@/lib/types";

export default function NuevaHabitacionPage() {
  const router = useRouter();
  const [tiposActivos, setTiposActivos] = useState<TipoHabitacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const tipos = await api.get<TipoHabitacion[]>("/tipos-habitacion?activos=true");
      setTiposActivos(tipos);
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

  return (
    <div className="flex flex-col min-h-full w-full">
      <PageHeader
        eyebrow="HAB-01 · Sprint 3"
        titulo="Registrar habitación"
        descripcion="Indicá el número y elegí el tipo."
      />

      <div className="w-full mt-4">
        <Card titulo="Datos de la nueva habitación">
          {error && (
            <div className="mb-4">
              <InfoBox tipo="error">{error}</InfoBox>
            </div>
          )}
          {cargando ? (
            <p className="py-10 text-center text-sm text-carbon/50">Cargando tipos de habitación…</p>
          ) : (
            <HabitacionForm
              tiposActivos={tiposActivos}
              onRegistrada={async () => {
                router.push("/habitaciones");
              }}
            />
          )}
        </Card>
      </div>
    </div>
  );
}