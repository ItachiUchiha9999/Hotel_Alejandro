"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Badge, Button, Card, EmptyState, InfoBox, Input,
  Table, THead, TH, TBody, TR, TD,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Comprobante } from "@/lib/types";

const tonoPorEstado = {
  PENDIENTE: "alerta",
  PAGADO: "activo",
  ANULADO: "inactivo",
} as const;

const plata = (valor: string | number) =>
  Number(valor).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fecha = (valor: string | null) =>
  valor ? new Date(valor).toLocaleDateString("es-AR") : "—";

/**
 * Listado de comprobantes registrados (PROV-01).
 *
 * Es la vista mínima para ver lo que se carga. Los filtros por tipo, fecha y
 * estado, y la administración de comprobantes anulados, son de PROV-03.
 */
export default function ComprobantesPage() {
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setComprobantes(await api.get<Comprobante[]>("/comprobantes"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los comprobantes.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return comprobantes;
    return comprobantes.filter((c) =>
      `${c.supplier_legal_name} ${c.supplier_trade_name ?? ""} ${c.voucher_type} ${c.voucher_full_number}`
        .toLowerCase()
        .includes(q),
    );
  }, [comprobantes, busqueda]);

  const totalPendiente = useMemo(
    () =>
      comprobantes
        .filter((c) => c.voucher_status === "PENDIENTE")
        .reduce((acc, c) => acc + Number(c.pending_amount), 0),
    [comprobantes],
  );

  return (
    <>
      <PageHeader
        eyebrow=""
        titulo="Comprobantes de proveedores"
        descripcion="Documentación recibida de cada proveedor, con su estado y su saldo pendiente."
        acciones={
          <Link href="/proveedores/comprobantes/nuevo">
            <Button>Registrar comprobante</Button>
          </Link>
        }
      />

      <Card>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Input
            type="search"
            placeholder="Buscar por proveedor, tipo o número"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="max-w-sm"
          />
          {totalPendiente > 0 && (
            <span className="ml-auto text-xs text-carbon/60">
              Pendiente de pago: <strong className="tabular-nums">$ {plata(totalPendiente)}</strong>
            </span>
          )}
        </div>

        {error && (
          <InfoBox tipo="error">
            {error}{" "}
            <button type="button" onClick={cargar} className="underline underline-offset-2">
              Reintentar
            </button>
          </InfoBox>
        )}

        {cargando ? (
          <p className="py-10 text-center text-sm text-carbon/50">Cargando comprobantes…</p>
        ) : visibles.length === 0 ? (
          <EmptyState
            titulo="No hay comprobantes registrados"
            descripcion={
              comprobantes.length === 0
                ? "Cuando recibas una factura de un proveedor, registrala acá para que quede en su cuenta corriente."
                : "Ningún comprobante coincide con la búsqueda."
            }
            accion={
              comprobantes.length === 0 ? (
                <Link href="/proveedores/comprobantes/nuevo">
                  <Button>Registrar el primero</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <THead>
              <TH>Comprobante</TH>
              <TH>Proveedor</TH>
              <TH>Emisión</TH>
              <TH>Vencimiento</TH>
              <TH className="text-right">Total</TH>
              <TH className="text-right">Pendiente</TH>
              <TH>Estado</TH>
            </THead>
            <TBody>
              {visibles.map((c) => (
                <TR key={c.voucher_id}>
                  <TD>
                    <span className="font-medium">{c.voucher_type.replaceAll("_", " ")}</span>
                    <span className="block font-mono text-xs text-carbon/50">
                      {c.voucher_full_number}
                    </span>
                  </TD>
                  <TD className="text-xs">
                    {c.supplier_trade_name ?? c.supplier_legal_name}
                  </TD>
                  <TD className="text-xs">{fecha(c.issue_date)}</TD>
                  <TD className="text-xs">
                    {fecha(c.due_date)}
                    {c.is_overdue && (
                      <span className="ml-1 text-[10px] font-semibold uppercase text-danger">
                        vencido
                      </span>
                    )}
                  </TD>
                  <TD className="text-right tabular-nums">$ {plata(c.total_amount)}</TD>
                  <TD className="text-right tabular-nums">$ {plata(c.pending_amount)}</TD>
                  <TD>
                    <Badge tono={tonoPorEstado[c.voucher_status]}>{c.voucher_status}</Badge>
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
