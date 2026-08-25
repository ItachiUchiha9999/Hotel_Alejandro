"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Button, Card, EmptyState, InfoBox, Select, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { api, ApiError, urlDescarga } from "@/lib/api";
import type { Deposito, Movimiento, TipoMovimiento } from "@/lib/types";

const tonoPorEfecto = {
  SUMA: "activo",
  RESTA: "alerta",
  TRANSFERENCIA: "info",
} as const;

export default function HistorialMovimientosPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [tipos, setTipos] = useState<TipoMovimiento[]>([]);
  const [deposito, setDeposito] = useState("");
  const [tipo, setTipo] = useState("");
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
        // Los filtros son opcionales: si fallan, el historial igual se muestra.
      }
    })();
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const params = new URLSearchParams();
    if (deposito) params.set("deposito", deposito);
    if (tipo) params.set("tipo", tipo);

    try {
      setMovimientos(await api.get<Movimiento[]>(`/stock/movimientos?${params}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el historial.");
    } finally {
      setCargando(false);
    }
  }, [deposito, tipo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function exportar() {
    const params = new URLSearchParams();
    if (deposito) params.set("deposito", deposito);
    if (tipo) params.set("tipo", tipo);
    window.open(urlDescarga(`/stock/movimientos/exportar?${params}`), "_blank");
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

  return (
    <>
      <PageHeader
        eyebrow="STK-05"
        titulo="Historial de movimientos"
        descripcion="Registro de auditoría de todas las entradas, salidas y transferencias de stock."
        acciones={
          <Button variante="secundario" onClick={exportar} disabled={movimientos.length === 0}>
            Exportar a Excel
          </Button>
        }
      />

      <Card>
        <div className="mb-5 flex flex-wrap gap-3">
          <Select
            value={deposito}
            onChange={(e) => setDeposito(e.target.value)}
            className="max-w-xs"
            aria-label="Filtrar por depósito"
          >
            <option value="">Todos los depósitos</option>
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
        </div>

        {error && <InfoBox tipo="error">{error}</InfoBox>}

        {cargando ? (
          <p className="py-10 text-center text-sm text-carbon/50">Cargando historial…</p>
        ) : movimientos.length === 0 ? (
          <EmptyState
            titulo="Sin movimientos registrados"
            descripcion="Cuando se registren ingresos, egresos o transferencias, van a aparecer acá."
          />
        ) : (
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
              {movimientos.map((m) => (
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
        )}
      </Card>
    </>
  );
}
