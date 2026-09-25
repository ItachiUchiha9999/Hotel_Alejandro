import { PageHeader } from "@/components/layout/PageHeader";
import { ReservaForm } from "@/components/reservas/ReservaForm";

export default function NuevaReservaPage() {
  return (
    <>
      <PageHeader
        eyebrow="Recepción y Reservas"
        titulo="Registrar reserva"
        descripcion="Asigná un cliente, una habitación y las fechas de estadía. La disponibilidad se valida nuevamente al guardar."
      />
      <ReservaForm />
    </>
  );
}
