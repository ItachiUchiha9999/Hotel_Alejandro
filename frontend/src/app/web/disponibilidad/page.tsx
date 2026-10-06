import { Suspense } from "react";
import { ResultadosDisponibilidad } from "@/components/publico/ResultadosDisponibilidad";

export default function DisponibilidadPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#f7f4ee] text-sm text-carbon/60">Cargando búsqueda…</main>}>
    <ResultadosDisponibilidad />
  </Suspense>;
}
