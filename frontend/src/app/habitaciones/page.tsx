"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  EmptyState,
  InfoBox,
  Input,
  Select,
} from "@/components/ui";

import { HabitacionesTabla } from "@/components/habitaciones/inventario/HabitacionesTable";

import { api, ApiError } from "@/lib/api";

import type {
  Habitacion,
  TipoHabitacion,
  EstadoHabitacion,
} from "@/lib/types";

export default function HabitacionesPage() {
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [tiposActivos, setTiposActivos] = useState<TipoHabitacion[]>([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);

  const HABITACIONES_POR_PAGINA = 10;

  /**
   * Carga las habitaciones y los tipos de habitación activos.
   */
  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);

      const [habs, tipos] = await Promise.all([
        api.get<Habitacion[]>("/habitaciones"),
        api.get<TipoHabitacion[]>("/tipos-habitacion?activos=true"),
      ]);

      setHabitaciones(habs);
      setTiposActivos(tipos);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo cargar el inventario de habitaciones."
      );
    } finally {
      setCargando(false);
    }
  }, []);

  /**
   * Carga inicial.
   */
  useEffect(() => {
    cargar();
  }, [cargar]);

  /**
   * Habitaciones que cumplen con los filtros actuales.
   */
  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return habitaciones.filter((h) => {
      // Buscar por número de habitación.
      if (
        texto &&
        !String(h.room_number).toLowerCase().includes(texto)
      ) {
        return false;
      }

      // Filtrar por tipo.
      if (
        filtroTipo &&
        String(h.room_type_id) !== filtroTipo
      ) {
        return false;
      }

      // Filtrar por estado operativo.
      if (
        filtroEstado &&
        h.room_state !== filtroEstado
      ) {
        return false;
      }

      return true;
    });
  }, [
    habitaciones,
    busqueda,
    filtroTipo,
    filtroEstado,
  ]);

  /**
   * Cantidad de páginas.
   */
  const totalPaginas = Math.max(
    1,
    Math.ceil(
      visibles.length / HABITACIONES_POR_PAGINA
    )
  );

  /**
   * Habitaciones correspondientes a la página actual.
   */
  const habitacionesPaginadas = useMemo(() => {
    const inicio =
      (paginaActual - 1) *
      HABITACIONES_POR_PAGINA;

    const fin =
      inicio + HABITACIONES_POR_PAGINA;

    return visibles.slice(inicio, fin);
  }, [visibles, paginaActual]);

  /**
   * Cuando cambian los filtros, volver a la primera página.
   */
  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, filtroTipo, filtroEstado]);

  /**
   * Evita quedarse en una página inexistente
   * cuando cambia la cantidad de resultados.
   */
  useEffect(() => {
    if (paginaActual > totalPaginas) {
      setPaginaActual(totalPaginas);
    }
  }, [paginaActual, totalPaginas]);

  /**
   * Indica si existe algún filtro activo.
   */
  const hayFiltros =
    busqueda.trim() !== "" ||
    filtroTipo !== "" ||
    filtroEstado !== "";

  /**
   * Limpia todos los filtros.
   */
  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroTipo("");
    setFiltroEstado("");
    setPaginaActual(1);
  };

  /**
   * Cambia el estado operativo de una habitación.
   */
  async function cambiarEstado(
    habitacion: Habitacion,
    nuevoEstado: EstadoHabitacion
  ) {
    // Evita enviar una petición si el estado no cambió.
    if (habitacion.room_state === nuevoEstado) {
      return;
    }

    setAviso(null);
    setError(null);

    try {
      await api.patch(
        `/habitaciones/${habitacion.room_id}/estado`,
        {
          estado: nuevoEstado,
        }
      );

      await cargar();

      setAviso(
        `La habitación ${habitacion.room_number} ahora está ${nuevoEstado.toLowerCase()}.`
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo cambiar el estado de la habitación."
      );
    }
  }

  const inicioResultados =
    visibles.length === 0
      ? 0
      : (paginaActual - 1) *
          HABITACIONES_POR_PAGINA +
        1;

  const finResultados = Math.min(
    paginaActual * HABITACIONES_POR_PAGINA,
    visibles.length
  );

  return (
    <div className="flex min-h-full w-full flex-col">
      <PageHeader
        eyebrow=""
        titulo="Inventario de habitaciones"
        descripcion=""
      />

      {/* Mensajes */}
      {(error || aviso) && (
        <div className="mb-5 flex flex-col gap-3">
          {error && (
            <InfoBox tipo="error">
              {error}
            </InfoBox>
          )}

          {aviso && (
            <InfoBox tipo="exito">
              {aviso}
            </InfoBox>
          )}
        </div>
      )}

      {/* Filtros y botón */}
      <div className="mt-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Buscar por número */}
          <Input
            type="search"
            placeholder="Buscar por número..."
            value={busqueda}
            onChange={(e) =>
              setBusqueda(e.target.value)
            }
            className="w-56"
          />

          {/* Tipo */}
          <div className="w-40">
            <Select
              value={filtroTipo}
              onChange={(e) =>
                setFiltroTipo(e.target.value)
              }
              aria-label="Filtrar por tipo"
            >
              <option value="">
                Todos los tipos
              </option>

              {tiposActivos.map((tipo) => (
                <option
                  key={tipo.room_type_id}
                  value={tipo.room_type_id}
                >
                  {tipo.room_type_name}
                </option>
              ))}
            </Select>
          </div>

          {/* Estado */}
          <div className="w-40">
            <Select
              value={filtroEstado}
              onChange={(e) =>
                setFiltroEstado(e.target.value)
              }
              aria-label="Filtrar por estado"
            >
              <option value="">
                Todos los estados
              </option>

              <option value="DISPONIBLE">
                Disponible
              </option>

              <option value="OCUPADA">
                Ocupada
              </option>

              <option value="MANTENIMIENTO">
                Mantenimiento
              </option>
            </Select>
          </div>

          {/* Limpiar filtros */}
          {hayFiltros && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="text-sm text-carbon/60 transition-colors hover:text-carbon"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Registrar habitación */}
        <Link
          href="/habitaciones/nuevo"
          className="flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-carbon shadow-sm transition-colors hover:bg-gold-dark"
        >
          <Plus size={16} />
          Registrar habitación
        </Link>
      </div>

      {/* Tabla */}
      <div className="w-full">
        <Card
          titulo="Habitaciones registradas"
          descripcion={
            hayFiltros
              ? `${visibles.length} habitación(es) coinciden con los filtros.`
              : `${habitaciones.length} habitación(es) registradas.`
          }
        >
          {cargando ? (
            <p className="py-10 text-center text-sm text-carbon/50">
              Cargando inventario…
            </p>
          ) : visibles.length === 0 ? (
            <EmptyState
              titulo={
                hayFiltros
                  ? "Ninguna habitación coincide"
                  : "Todavía no hay habitaciones"
              }
              descripcion={
                hayFiltros
                  ? "Probá con otros filtros o limpiá la búsqueda."
                  : "Registrá la primera con el botón superior."
              }
            />
          ) : (
            <>
              <HabitacionesTabla
                habitaciones={habitacionesPaginadas}
                onAlternarEstado={cambiarEstado}
              />

              {/* Paginación */}
              {totalPaginas > 1 && (
                <div className="flex flex-col gap-3 border-t border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Información */}
                  <p className="text-sm text-carbon/60">
                    Mostrando{" "}
                    <span className="font-medium text-carbon">
                      {inicioResultados}
                    </span>{" "}
                    a{" "}
                    <span className="font-medium text-carbon">
                      {finResultados}
                    </span>{" "}
                    de{" "}
                    <span className="font-medium text-carbon">
                      {visibles.length}
                    </span>{" "}
                    habitación(es)
                  </p>

                  {/* Controles */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPaginaActual((pagina) =>
                          Math.max(1, pagina - 1)
                        )
                      }
                      disabled={paginaActual === 1}
                      aria-label="Página anterior"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-carbon transition-colors hover:bg-carbon/5 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    <span className="min-w-20 text-center text-sm font-medium text-carbon">
                      Página {paginaActual} de{" "}
                      {totalPaginas}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setPaginaActual((pagina) =>
                          Math.min(
                            totalPaginas,
                            pagina + 1
                          )
                        )
                      }
                      disabled={
                        paginaActual ===
                        totalPaginas
                      }
                      aria-label="Página siguiente"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-carbon transition-colors hover:bg-carbon/5 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}