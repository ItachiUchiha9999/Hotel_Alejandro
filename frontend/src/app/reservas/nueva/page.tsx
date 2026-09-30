import { PageHeader } from "@/components/layout/PageHeader";
import { ReservaForm } from "@/components/reservas/ReservaForm";

export default function NuevaReservaPage() {
  return (
    <>
      <PageHeader
        eyebrow=""
        titulo="Registrar reserva"
        descripcion=""
      />
      <ReservaForm />
    </>
  );
}
