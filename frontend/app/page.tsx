"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui";
import Link from "next/link";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";

interface Deposito {
  id: number;
  nombre: string;
  estado: string;
}

export default function DepositosPage() {
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [cargando, setCargando] = useState(true);
  
  // Estados para el buscador y el filtro de selección
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Estado: todos");

  useEffect(() => {
    const cargarDepositos = async () => {
      try {
        const data = (await api.get("/depositos")) as Deposito[];
        setDepositos(data);
      } catch (error) {
        console.error("Error al cargar depósitos", error);
      } finally {
        setCargando(false);
      }
    };
    cargarDepositos();
  }, []);

  // Lógica de filtrado en tiempo real
  const depositosFiltrados = depositos.filter((deposito) => {
    const coincideNombre = deposito.nombre.toLowerCase().includes(busqueda.toLowerCase());
    
    if (filtroEstado === "Activos") {
      return coincideNombre && deposito.estado === "Activo";
    }
    if (filtroEstado === "Inactivos") {
      return coincideNombre && deposito.estado === "Inactivo";
    }
    
    return coincideNombre;
  });

  return (
    <div className="flex flex-col min-h-full w-full">
      <PageHeader
        eyebrow="STK-01"
        titulo="Depósitos"
        descripcion="Gestión de ubicaciones físicas del inventario."
      />

      {/* BARRA SUPERIOR CON FILTROS */}
      <div className="flex flex-wrap justify-between items-center mb-6 mt-4 gap-4">
        <div className="flex gap-4">
          <input 
            type="text" 
            placeholder="Buscar por nombre o código..." 
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="px-3 py-1.5 border border-line rounded-md text-sm text-carbon focus:outline-none focus:border-gold bg-white" 
          />
          <select 
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-3 py-1.5 border border-line rounded-md text-sm text-carbon focus:outline-none focus:border-gold bg-white"
          >
            <option>Estado: todos</option>
            <option>Activos</option>
            <option>Inactivos</option>
          </select>
        </div>
        
        <Link 
          href="/stock/depositos/nuevo" 
          className="flex items-center gap-2 px-4 py-2 bg-gold hover:bg-gold-dark text-carbon font-semibold rounded-md text-sm transition-colors shadow-sm"
        >
          <Plus size={16} />
          Registrar depósito
        </Link>
      </div>

      <div className="w-full mt-4">
        <Card titulo="Depósitos registrados">
          {cargando ? (
            <div className="p-8 text-center text-carbon/50 text-sm">Cargando depósitos...</div>
          ) : depositosFiltrados.length === 0 ? (
            <div className="p-8 text-center text-carbon/50 text-sm">No se encontraron depósitos con esos criterios.</div>
          ) : (
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-sm text-carbon">
                <thead className="border-b border-line bg-carbon/5 text-xs uppercase text-carbon/60">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nombre</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {depositosFiltrados.map((deposito) => (
                    <tr key={deposito.id} className="border-b border-line hover:bg-carbon/5 transition-colors">
                      <td className="px-4 py-3 font-medium">{deposito.nombre}</td>
                      <td className="px-4 py-3">
                        {/* Colores elegantes acordes al sistema */}
                        <span className={`inline-block py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider text-center ${
                        deposito.estado === 'Activo' 
                          ? 'bg-[#E2E8D8] text-[#3B4D28] border border-[#C5D4B4]' 
                          : 'bg-[#F9E8E8] text-[#8C3A3A] border border-[#F1C6C6]'
                      }`}
                      style={{ width: "100px" }}
                      >
                        {deposito.estado}
                      </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link 
                          href={`/stock/depositos/${deposito.id}`}
                          className="text-gold hover:text-gold-dark font-medium text-xs transition-colors"
                        >
                          Editar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}