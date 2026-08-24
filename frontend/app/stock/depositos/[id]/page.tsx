"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

export default function EditarDepositoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;

  const [nombre, setNombre] = useState("");
  const [estado, setEstado] = useState("Activo");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const cargarDeposito = async () => {
      try {
        const data = (await api.get(`/depositos/${id}`)) as { nombre: string; estado: string };
        setNombre(data.nombre);
        setEstado(data.estado);
      } catch (err) {
        setError("No se pudo cargar la información del depósito.");
      } finally {
        setCargando(false);
      }
    };
    if (id) cargarDeposito();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setGuardando(true);

    try {
      // 👇 CAMBIAMOS A POST PARA EVITAR PROBLEMAS DE CONFIGURACIÓN EN EL BACKEND
      await api.post(`/depositos/${id}`, { nombre, estado });
      router.push("/stock/depositos");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Error al actualizar el depósito.");
      }
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return <div className="p-8 text-center text-carbon/50">Cargando datos...</div>;
  }

  return (
    <div className="flex flex-col min-h-full w-full">
      <PageHeader 
        eyebrow="STK-01" 
        titulo="Editar depósito" 
        descripcion="Modifica los datos del depósito seleccionado." 
      />

      <div className="w-full mt-4">
        <Card titulo="Datos del depósito">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
            {error && (
              <div className="bg-danger/10 border border-danger text-danger text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-sans tracking-[1.4px] text-carbon/60 font-semibold">
                  NOMBRE DEL DEPÓSITO *
                </label>
                <input 
                  type="text" 
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="px-3 py-2 border border-line rounded-md text-sm text-carbon focus:outline-none focus:border-gold bg-white transition-colors"
                  required
                  disabled={guardando}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-sans tracking-[1.4px] text-carbon/60 font-semibold">
                  ESTADO *
                </label>
                <select 
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="px-3 py-2 border border-line rounded-md text-sm text-carbon focus:outline-none focus:border-gold bg-white transition-colors"
                  disabled={guardando}
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-2 border-t border-line pt-4">
              <button 
                type="button" 
                onClick={() => router.push("/stock/depositos")}
                className="px-4 py-2 border border-line rounded-md text-sm text-carbon hover:bg-carbon/5 transition-colors"
                disabled={guardando}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={guardando} 
                className="px-4 py-2 bg-gold hover:bg-gold-dark text-carbon font-semibold rounded-md text-sm transition-colors disabled:opacity-50"
              >
                {guardando ? "Guardando cambios..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}