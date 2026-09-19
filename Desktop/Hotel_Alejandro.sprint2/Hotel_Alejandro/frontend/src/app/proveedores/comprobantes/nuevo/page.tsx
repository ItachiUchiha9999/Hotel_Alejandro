import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui";
import { ComprobanteForm } from "@/components/comprobantes/ComprobanteForm";

export default function NuevoComprobantePage() {
  return (
    <>
      <PageHeader
        eyebrow=""
        titulo="Registrar comprobante"
        descripcion="Documentación recibida de proveedores: facturas, notas de crédito y de débito. Queda pendiente de pago hasta que se le aplique una orden."
      />
      <Card>
        <ComprobanteForm />
      </Card>
    </>
  );
}