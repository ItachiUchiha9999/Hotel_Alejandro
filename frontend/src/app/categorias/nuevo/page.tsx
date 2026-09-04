import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui";
import { CategoriaForm } from "@/components/categorias/CategoriaForm";

export default function NuevaCategoriaPage() {
    return (
        <>
            <PageHeader
               
                titulo="Nueva categoría"
               
            />
            <Card>
                <CategoriaForm />
            </Card>
        </>
    );
}