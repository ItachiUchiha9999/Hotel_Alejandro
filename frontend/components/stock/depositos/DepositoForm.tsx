"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";

export function DepositoForm() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [estado, setEstado] = useState("Activo");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCargando(true);

    try {
      await api.post("/depositos", { nombre, estado });
      router.push("/stock/depositos"); 
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Error al guardar el depósito. Revisa tu conexión.");
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    // 👇 AQUÍ ESTÁ LA MAGIA: Le agregamos "w-full" al final de las clases del form
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
      {/* Alerta de Error */}
      {error && (
        <div className="bg-danger/10 border border-danger text-danger text-sm p-3 rounded-md">
          {error}
        </div>
      )}

      {/* Grid para inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-sans tracking-[1.4px] text-carbon/60 font-semibold">
            NOMBRE DEL DEPÓSITO *
          </label>
          <input 
            type="text" 
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Depósito Cocina" 
            className="px-3 py-2 border border-line rounded-md text-sm text-carbon focus:outline-none focus:border-gold bg-white transition-colors"
            required
            disabled={cargando}
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
            disabled={cargando}
          >
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </div>
      </div>

      {/* Regla de negocio de la Historia de Usuario */}
      <div className="bg-carbon/5 p-4 rounded-md border border-line">
        <p className="text-sm text-carbon/70">
          <strong className="text-carbon">Regla automática:</strong> un depósito inactivo deja de aparecer en los formularios de movimientos y no puede recibir ingresos ni transferencias.
        </p>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 mt-2 border-t border-line pt-4">
        <button 
          type="button" 
          onClick={() => router.push("/stock/depositos")}
          className="px-4 py-2 border border-line rounded-md text-sm text-carbon hover:bg-carbon/5 transition-colors"
          disabled={cargando}
        >
          Cancelar
        </button>
        <button 
          type="submit" 
          disabled={cargando} 
          className="px-4 py-2 bg-gold hover:bg-gold-dark text-carbon font-semibold rounded-md text-sm transition-colors disabled:opacity-50"
        >
          {cargando ? "Guardando..." : "Guardar depósito"}
        </button>
      </div>
    </form>
  );
}