import { PageHeader } from "@/components/layout/PageHeader";
import { ConsultaDisponibilidad } from "@/components/habitaciones/ConsultaDisponibilidad";

export default function DisponibilidadPage() {
  return (
    <>
      <PageHeader
        eyebrow=""
        titulo="Consulta de disponibilidad"
        descripcion=""
      />
      <ConsultaDisponibilidad />
    </>
  );
}