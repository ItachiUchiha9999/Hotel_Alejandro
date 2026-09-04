import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui";
import { DepositoForm } from "@/components/stock/depositos/DepositoForm";

export default function NuevoDepositoPage() {
  return (
    <>
      <PageHeader
        
        titulo="Nuevo depósito"
        descripcion="Los depósitos nuevos quedan activos y disponibles para recibir movimientos."
      />
      <Card>
        <DepositoForm />
      </Card>
    </>
  );
}
