import { PageHeader } from "@/components/layout/PageHeader";
import { ConsultaDisponibilidad } from "@/components/habitaciones/ConsultaDisponibilidad";

export default function DisponibilidadPage() {
  return (
    <>
      <PageHeader
        eyebrow="Recepción y Reservas"
        titulo="Consulta de disponibilidad"
        descripcion="Búsqueda de habitaciones por rango de fechas y capacidad con presupuesto estimado de estadía (RES-05)."
      />
      <ConsultaDisponibilidad />
    </>
  );
}