"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Card, EmptyState, InfoBox, Input, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { FilaSaldo } from "@/lib/types";

const ELEMENTOS_POR_PAGINA = 10;

export default function SaldoConsolidadoPage() {
  const [filas, setFilas] = useState<FilaSaldo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        setFilas(await api.get<FilaSaldo[]>("/stock"));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "No se pudo cargar el saldo.");
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((f) =>
      `${f.articles.article_code} ${f.articles.article_name} ${f.deposit.deposit_name}`
        .toLowerCase()
        .includes(q),
    );
  }, [filas, busqueda]);

  // Al escribir en el buscador se reinicia a la primera página
  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda]);

  const totalPaginas = Math.ceil(visibles.length / ELEMENTOS_POR_PAGINA) || 1;
  const filasPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * ELEMENTOS_POR_PAGINA;
    return visibles.slice(inicio, inicio + ELEMENTOS_POR_PAGINA);
  }, [visibles, paginaActual]);

  const bajoMinimo = (f: FilaSaldo) =>
    Number(f.stock_amount) < Number(f.articles.article_stock_min_general);

  return (
    <>
      <PageHeader
        eyebrow=""
        titulo="Saldo consolidado"
        descripcion=""
      />

      <Card>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Input
            type="search"
            placeholder="Buscar por artículo, código o depósito"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="max-w-sm"
          />
          {busqueda && (
            <span className="text-xs text-carbon/50">
              {visibles.length} resultado{visibles.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {error && <InfoBox tipo="error">{error}</InfoBox>}

        {cargando ? (
          <p className="py-10 text-center text-sm text-carbon/50">Cargando saldo…</p>
        ) : visibles.length === 0 ? (
          <EmptyState
            titulo="Sin existencias para mostrar"
            descripcion={
              filas.length === 0
                ? "Todavía no hay stock cargado. Registrá un ingreso para empezar."
                : "Ningún artículo coincide con la búsqueda."
            }
          />
        ) : (
          <>
            <Table>
              <THead>
                <TH>Código</TH>
                <TH>Artículo</TH>
                <TH>Depósito</TH>
                <TH className="text-right">Existencia</TH>
                <TH className="text-right">Mínimo</TH>
                <TH>Estado</TH>
              </THead>
              <TBody>
                {filasPaginadas.map((f) => {
                  const inactivo = f.articles.article_state === false;
                  return (
                    <TR
                      key={f.stock_id}
                      className={inactivo ? "bg-slate-50/60 opacity-75" : ""}
                    >
                      <TD className="font-mono text-xs">
                        {f.articles.article_code}
                      </TD>
                      <TD className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{f.articles.article_name}</span>
                          {inactivo && (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                              Dado de baja
                            </span>
                          )}
                        </div>
                      </TD>
                      <TD>{f.deposit.deposit_name}</TD>
                      <TD className="text-right tabular-nums">
                        {Number(f.stock_amount).toLocaleString("es-AR")}{" "}
                        <span className="text-xs text-carbon/50">
                          {f.articles.article_unit_of_measure.toLowerCase()}
                        </span>
                      </TD>
                      <TD className="text-right tabular-nums text-carbon/60">
                        {Number(f.articles.article_stock_min_general).toLocaleString("es-AR")}
                      </TD>
                      <TD>
                        {inactivo ? (
                          <Badge tono="alerta">Discontinuado</Badge>
                        ) : bajoMinimo(f) ? (
                          <Badge tono="alerta">Bajo mínimo</Badge>
                        ) : (
                          <Badge tono="activo">Normal</Badge>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>

            {/* Controles de Paginación */}
            {totalPaginas > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-carbon/10 pt-4 text-xs text-carbon/70">
                <span>
                  Mostrando del{" "}
                  <strong>{(paginaActual - 1) * ELEMENTOS_POR_PAGINA + 1}</strong> al{" "}
                  <strong>{Math.min(paginaActual * ELEMENTOS_POR_PAGINA, visibles.length)}</strong> de{" "}
                  <strong>{visibles.length}</strong> existencias
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={paginaActual === 1}
                    onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
                    className="rounded border border-carbon/15 bg-white px-2.5 py-1.5 font-medium transition hover:bg-carbon/5 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
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
                    className="rounded border border-carbon/15 bg-white px-2.5 py-1.5 font-medium transition hover:bg-carbon/5 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
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