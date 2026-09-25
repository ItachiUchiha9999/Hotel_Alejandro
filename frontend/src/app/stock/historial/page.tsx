"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Button, Card, EmptyState, InfoBox, Select, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { api, ApiError, urlDescarga } from "@/lib/api";
import type { Deposito, Movimiento, TipoMovimiento } from "@/lib/types";

const tonoPorEfecto = {
  SUMA: "activo",
  RESTA: "alerta",
  TRANSFERENCIA: "info",
} as const;

const ELEMENTOS_POR_PAGINA = 10;

export default function HistorialMovimientosPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [tipos, setTipos] = useState<TipoMovimiento[]>([]);
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [tipo, setTipo] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [d, t] = await Promise.all([
          api.get<Deposito[]>("/depositos"),
          api.get<TipoMovimiento[]>("/stock/tipos-movimiento"),
        ]);
        setDepositos(d);
        setTipos(t);
      } catch {
        // Los filtros son opcionales
      }
    })();
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const params = new URLSearchParams();
    if (origen) params.set("origen", origen);
    if (destino) params.set("destino", destino);
    if (tipo) params.set("tipo", tipo);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);

    try {
      setMovimientos(await api.get<Movimiento[]>(`/stock/movimientos?${params}`));
      setPaginaActual(1); // Reiniciar a la página 1 al filtrar
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el historial.");
    } finally {
      setCargando(false);
    }
  }, [origen, destino, tipo, desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function exportar() {
    const params = new URLSearchParams();
    if (origen) params.set("origen", origen);
    if (destino) params.set("destino", destino);
    if (tipo) params.set("tipo", tipo);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    window.open(urlDescarga(`/stock/movimientos/exportar?${params}`), "_blank");
  }

  function limpiarFiltros() {
    setOrigen("");
    setDestino("");
    setTipo("");
    setDesde("");
    setHasta("");
    setPaginaActual(1);
  }

  /** En una transferencia hay dos filas de detalle; se muestra una por artículo. */
  function articulosDe(mov: Movimiento) {
    const vistos = new Map<string, number>();
    for (const d of mov.movement_stock_detail) {
      const art = d.articles_deposit_stock?.articles;
      if (!art) continue;
      if (!vistos.has(art.article_code)) vistos.set(art.article_code, Number(d.amount));
    }
    return [...vistos.entries()];
  }

  // Lógica de cálculo de páginas
  const totalPaginas = Math.ceil(movimientos.length / ELEMENTOS_POR_PAGINA) || 1;
  const movimientosPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * ELEMENTOS_POR_PAGINA;
    return movimientos.slice(inicio, inicio + ELEMENTOS_POR_PAGINA);
  }, [movimientos, paginaActual]);

  const hayFiltros = Boolean(origen || destino || tipo || desde || hasta);

  return (
    <>
      <PageHeader
        eyebrow=""
        titulo="Historial de movimientos"
        descripcion=""
        acciones={
          <Button variante="secundario" onClick={exportar} disabled={movimientos.length === 0}>
            Exportar a Excel
          </Button>
        }
      />

      <Card>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Select
            value={origen}
            onChange={(e) => setOrigen(e.target.value)}
            className="max-w-xs"
            aria-label="Filtrar por depósito de origen"
          >
            <option value="">Depósito origen: todos</option>
            {depositos.map((d) => (
              <option key={d.deposit_id} value={d.deposit_id}>
                {d.deposit_name}
              </option>
            ))}
          </Select>

          <Select
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            className="max-w-xs"
            aria-label="Filtrar por depósito de destino"
          >
            <option value="">Depósito destino: todos</option>
            {depositos.map((d) => (
              <option key={d.deposit_id} value={d.deposit_id}>
                {d.deposit_name}
              </option>
            ))}
          </Select>

          <Select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="max-w-xs"
            aria-label="Filtrar por tipo"
          >
            <option value="">Todos los tipos</option>
            {tipos.map((t) => (
              <option key={t.movement_type_id} value={t.movement_type}>
                {t.movement_type.replaceAll("_", " ")}
              </option>
            ))}
          </Select>

          {/* Selector Fecha Desde */}
          <div className="flex items-center gap-1.5 rounded-lg border border-carbon/15 bg-white px-3 py-1.5 text-xs text-carbon/70 shadow-sm focus-within:border-dorado">
            <span className="font-medium text-carbon/50">Desde:</span>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="bg-transparent text-xs text-carbon outline-none cursor-pointer"
              aria-label="Fecha desde"
            />
          </div>

          {/* Selector Fecha Hasta */}
          <div className="flex items-center gap-1.5 rounded-lg border border-carbon/15 bg-white px-3 py-1.5 text-xs text-carbon/70 shadow-sm focus-within:border-dorado">
            <span className="font-medium text-carbon/50">Hasta:</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="bg-transparent text-xs text-carbon outline-none cursor-pointer"
              aria-label="Fecha hasta"
            />
          </div>

          {hayFiltros && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="text-xs text-alerta hover:underline cursor-pointer px-1 py-1 font-medium transition"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {error && <InfoBox tipo="error">{error}</InfoBox>}

        {cargando ? (
          <p className="py-10 text-center text-sm text-carbon/50">Cargando historial…</p>
        ) : movimientos.length === 0 ? (
          <EmptyState
            titulo="Sin movimientos registrados"
            descripcion="No se encontraron movimientos para los filtros seleccionados."
          />
        ) : (
          <>
            <Table>
              <THead>
                <TH>Fecha</TH>
                <TH>Tipo</TH>
                <TH>Origen</TH>
                <TH>Destino</TH>
                <TH>Artículos</TH>
                <TH>Empleado</TH>
              </THead>
              <TBody>
                {movimientosPaginados.map((m) => (
                  <TR key={m.stock_movement_id}>
                    <TD className="whitespace-nowrap text-xs">
                      {new Date(m.transaction_date).toLocaleString("es-AR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </TD>
                    <TD>
                      <Badge tono={tonoPorEfecto[m.movement_type.effect] ?? "info"}>
                        {m.movement_type.movement_type.replaceAll("_", " ")}
                      </Badge>
                    </TD>
                    <TD>{m.deposit_origin?.deposit_name ?? "—"}</TD>
                    <TD>{m.deposit_destination?.deposit_name ?? "—"}</TD>
                    <TD>
                      {articulosDe(m).map(([codigo, cantidad]) => (
                        <div key={codigo} className="text-xs">
                          <span className="font-mono">{codigo}</span>
                          <span className="text-carbon/50"> × {cantidad}</span>
                        </div>
                      ))}
                      {m.observations && (
                        <p className="mt-1 text-xs italic text-carbon/45">{m.observations}</p>
                      )}
                    </TD>
                    <TD className="text-xs">
                      {m.employees.employees_name} {m.employees.employees_lastname}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>

            {/* Controles de Paginación */}
            {totalPaginas > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-carbon/10 pt-4 text-xs text-carbon/70">
                <span>
                  Mostrando del{" "}
                  <strong>{(paginaActual - 1) * ELEMENTOS_POR_PAGINA + 1}</strong> al{" "}
                  <strong>{Math.min(paginaActual * ELEMENTOS_POR_PAGINA, movimientos.length)}</strong> de{" "}
                  <strong>{movimientos.length}</strong> movimientos
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={paginaActual === 1}
                    onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
                    className="rounded border border-carbon/15 bg-white px-2.5 py-1.5 font-medium transition hover:bg-carbon/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Anterior
                  </button>

                  <span className="px-1 text-carbon/60">
                    Página <strong>{paginaActual}</strong> de <strong>{totalPaginas}</strong>
                  </span>

                  <button
                    type="button"
                    disabled={paginaActual === totalPaginas}
                    onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
                    className="rounded border border-carbon/15 bg-white px-2.5 py-1.5 font-medium transition hover:bg-carbon/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}