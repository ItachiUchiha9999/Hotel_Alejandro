"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Plus, Eye, Edit, Trash2, MoreVertical } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import {
  TableContainer,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { api, getHuespedes, ApiError } from "@/lib/api";
import type { Huesped } from "@/lib/types";
import { format, isValid, parseISO } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";

type FiltroEstado = "todos" | "activos" | "inactivos";

/** Minúsculas y sin tildes, para que "jose" encuentre "José". */
const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Formatea fechas de nacimiento sin corrimiento de zona horaria:
 * new Date("1990-05-10") se interpreta como UTC y en Argentina (GMT-3) mostraría 09/05.
 */
const formatearFecha = (valor?: string | null) => {
  if (!valor) return "—";
  const d = parseISO(valor.slice(0, 10));
  return isValid(d) ? format(d, "dd/MM/yyyy") : "—";
};

const accionesItems: DropdownItem[] = [
  { label: "Ver detalle", value: "ver", icon: <Eye className="w-4 h-4" /> },
  { label: "Editar", value: "editar", icon: <Edit className="w-4 h-4" /> },
  { divider: true },
  { label: "Desactivar", value: "eliminar", icon: <Trash2 className="w-4 h-4" />, danger: true },
];

export default function HuespedesPage() {
  const router = useRouter();
  const [huespedes, setHuespedes] = useState<Huesped[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");

  const cargarHuespedes = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);
      setHuespedes(await getHuespedes());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la lista de huéspedes.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarHuespedes();
  }, [cargarHuespedes]);

  const termino = normalizar(busqueda.trim());

  const huespedesFiltrados = huespedes.filter((h) => {
    const coincideBusqueda =
      termino === "" ||
      normalizar(`${h.first_name} ${h.last_name}`).includes(termino) ||
      normalizar(h.document_number).includes(termino) ||
      (h.email ? normalizar(h.email).includes(termino) : false) ||
      (h.phone ? h.phone.includes(busqueda.trim()) : false);
    const coincideEstado =
      filtroEstado === "todos" ||
      (filtroEstado === "activos" && h.guest_state) ||
      (filtroEstado === "inactivos" && !h.guest_state);
    return coincideBusqueda && coincideEstado;
  });

  const handleAccion = async (value: string, huesped: Huesped) => {
    switch (value) {
      case "ver":
        // TODO: reemplazar el alert por una página o modal de detalle
        alert(
          `Ver detalle de ${huesped.first_name} ${huesped.last_name}\nDocumento: ${huesped.document_type} ${huesped.document_number}\nEmail: ${huesped.email ?? "—"}\nTeléfono: ${huesped.phone ?? "—"}\nNacionalidad: ${huesped.nationality ?? "—"}\nDirección: ${huesped.address ?? "—"}\nFecha de nacimiento: ${formatearFecha(huesped.birth_date)}\nEstado: ${huesped.guest_state ? "Activo" : "Inactivo"}\nNotas: ${huesped.observations ?? "—"}`
        );
        break;
      case "editar":
        router.push(`/huespedes/${huesped.guest_id}/editar`);
        break;
      case "eliminar":
        if (
          confirm(
            `¿Desactivar a ${huesped.first_name} ${huesped.last_name}? Se marcará el huésped como inactivo.`
          )
        ) {
          try {
            // El backend no tiene endpoint DELETE para huéspedes: se desactiva con PATCH
            await api.patch(`/reservas/clientes/${huesped.guest_id}`, { guest_state: false });
            setHuespedes((prev) =>
              prev.map((h) => (h.guest_id === huesped.guest_id ? { ...h, guest_state: false } : h))
            );
          } catch (err) {
            alert(err instanceof ApiError ? err.message : "No se pudo desactivar el huésped.");
          }
        }
        break;
    }
  };

  return (
    <>
      <PageHeader
        titulo="Huéspedes"
        descripcion="Gestioná la base de datos de huéspedes"
        acciones={
          <Link href="/huespedes/nuevo">
            <Button leftIcon={<Plus className="w-4 h-4" />} size="sm">
              Nuevo huésped
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Input
          placeholder="Buscar por nombre, documento, email o teléfono"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          className="w-full sm:w-96"
          aria-label="Buscar huéspedes"
        />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
          aria-label="Filtrar por estado"
          className="px-3 py-2 text-sm border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gold-400"
        >
          <option value="todos">Todos los estados</option>
          <option value="activos">Solo activos</option>
          <option value="inactivos">Solo inactivos</option>
        </select>
        {!cargando && !error && (
          <span className="text-sm text-neutral-500 sm:ml-auto">
            {huespedesFiltrados.length} de {huespedes.length} huéspedes
          </span>
        )}
      </div>

      <Card padding="none" className="overflow-hidden">
        {cargando ? (
          <SkeletonTable rows={6} columns={7} />
        ) : error ? (
          <div className="py-10 text-center">
            <p className="text-sm text-danger-700 mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={cargarHuespedes}>
              Reintentar
            </Button>
          </div>
        ) : (
          <TableContainer>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: "26%" }}>Huésped</TableHead>
                <TableHead style={{ width: "16%" }}>Documento</TableHead>
                <TableHead style={{ width: "22%" }}>Contacto</TableHead>
                <TableHead style={{ width: "12%" }}>Nacionalidad</TableHead>
                <TableHead style={{ width: "10%" }}>Nacimiento</TableHead>
                <TableHead style={{ width: "8%" }}>Estado</TableHead>
                <TableHead align="right" style={{ width: "6%" }}>
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {huespedesFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell className="py-10 text-neutral-500 text-center" colSpan={7}>
                    No se encontraron huéspedes
                  </TableCell>
                </TableRow>
              ) : (
                huespedesFiltrados.map((huesped) => (
                  <TableRow key={huesped.guest_id} hover>
                    <TableCell className="py-3 px-4">
                      <p className="font-medium text-sm">
                        {huesped.first_name} {huesped.last_name}
                      </p>
                      {huesped.observations && (
                        <p className="mt-0.5 text-xs text-neutral-500 truncate max-w-xs">
                          {huesped.observations}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <span className="font-mono text-xs">
                        {huesped.document_type} {huesped.document_number}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <div className="space-y-1">
                        <p className="text-xs">{huesped.email ?? <span className="text-neutral-400">—</span>}</p>
                        <p className="text-xs text-neutral-500">
                          {huesped.phone ?? <span className="text-neutral-400">—</span>}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-xs">{huesped.nationality ?? "—"}</TableCell>
                    <TableCell className="py-3 px-4 text-xs">{formatearFecha(huesped.birth_date)}</TableCell>
                    <TableCell className="py-3 px-4">
                      <Badge variant={huesped.guest_state ? "success" : "default"} className="text-xs">
                        {huesped.guest_state ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell align="right" className="py-3 px-4">
                      <Dropdown
                        trigger={
                          <Button variant="ghost" size="icon" aria-label="Acciones">
                            <MoreVertical className="w-5 h-5" />
                          </Button>
                        }
                        items={accionesItems}
                        onSelect={(value) => handleAccion(value, huesped)}
                        align="right"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </TableContainer>
        )}
      </Card>
    </>
  );
}