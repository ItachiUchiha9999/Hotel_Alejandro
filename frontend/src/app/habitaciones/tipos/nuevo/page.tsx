"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui";
import { TipoHabitacionForm } from "@/components/habitaciones/TipoHabitacionForm";

export default function NuevoTipoHabitacionPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-full w-full">
      <PageHeader
        eyebrow="HAB-03 · Sprint 3"
        titulo="Nuevo tipo de habitación"
        descripcion="Completá los datos para sumarlo al catálogo."
      />

      <div className="w-full mt-4">
        <Card titulo="Datos del tipo de habitación">
          <TipoHabitacionForm
            tipo={null}
            onGuardado={async () => {
              router.push("/habitaciones/tipos");
            }}
            onCancelar={() => {
              router.push("/habitaciones/tipos");
            }}
          />
        </Card>
      </div>
    </div>
  );
}