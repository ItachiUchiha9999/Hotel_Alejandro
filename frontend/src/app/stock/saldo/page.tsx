"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Card, EmptyState, InfoBox, Input, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { FilaSaldo } from "@/lib/types";

export default function SaldoConsolidadoPage() {
  const [filas, setFilas] = useState<FilaSaldo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

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

  const bajoMinimo = (f: FilaSaldo) =>
    Number(f.stock_amount) < Number(f.articles.article_stock_min_general);

  return (
    <>
      <PageHeader
        eyebrow="STK-03"
        titulo="Saldo consolidado"
        descripcion="Existencias de cada artículo en cada depósito. Se resaltan las que están por debajo del stock mínimo."
      />

      <Card>
        <div className="mb-5">
          <Input
            type="search"
            placeholder="Buscar por artículo, código o depósito"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="max-w-sm"
          />
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
              {visibles.map((f) => (
                <TR key={f.stock_id}>
                  <TD className="font-mono text-xs">{f.articles.article_code}</TD>
                  <TD className="font-medium">{f.articles.article_name}</TD>
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
                    {bajoMinimo(f) ? (
                      <Badge tono="alerta">Bajo mínimo</Badge>
                    ) : (
                      <Badge tono="activo">Normal</Badge>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
