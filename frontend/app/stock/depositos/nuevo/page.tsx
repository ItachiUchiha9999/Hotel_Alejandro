import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui";
import { DepositoForm } from "@/components/stock/depositos/DepositoForm";

export default function NuevoDepositoPage() {
  return (
    <div className="flex flex-col min-h-full w-full">
      <PageHeader 
        eyebrow="" 
        titulo="Registrar depósito" 
        descripcion="El nombre identifica la ubicación y no puede repetirse." 
      />

      <div className="w-full mt-4">
        <Card titulo="Datos del depósito">
          <DepositoForm />
        </Card>
      </div>
    </div>
  );
}