"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Badge,
  Card,
  EmptyState,
  Field,
  FieldGrid,
  InfoBox,
  Select,
  Table,
  THead,
  TH,
  TBody,
  TR,
  TD,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Proveedor } from "@/lib/types";

/* ============================================================
   TIPOS
   ============================================================ */

interface MetodoPago {
  payment_method_id: number;
  payment_method: string;
  active: boolean;
}

interface MovimientoCC {
  account_movement_id: number;
  movement_date: string;
  concept: string;
  debit: string | number;
  credit: string | number;
  balance: string | number;
  voucher: {
    voucher_id: number;
    voucher_type: string;
    voucher_status: "PENDIENTE" | "PAGADO" | "ANULADO";
    is_overdue: boolean;
  } | null;
  payment: {
    payment_order_id: number;
    payment_reference: string | null;
    payment_method_id: number;
    payment_method: string;
  } | null;
}

interface CuentaCorriente {
  supplier: {
    supplier_id: number;
    supplier_legal_name: string;
    supplier_trade_name: string | null;
  };
  saldo_actual: string | number;
  cuenta_al_dia: boolean;
  total_facturado: string | number;
  total_pagado: string | number;
  comprobantes_pendientes: number;
  movimientos: MovimientoCC[];
}

/* ============================================================
   HELPERS
   ============================================================ */

const plata = (valor: string | number) =>
  Number(valor).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fecha = (valor: string | null) => {
  if (!valor) return "—";
  return new Date(valor).toLocaleDateString("es-AR", { timeZone: "UTC" });
};

const ESTADO_COMPROBANTE_TONO: Record<
  NonNullable<MovimientoCC["voucher"]>["voucher_status"],
  "activo" | "inactivo" | "info" | "alerta"
> = {
  PENDIENTE: "alerta",
  PAGADO: "activo",
  ANULADO: "inactivo",
};

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */

export default function CuentaCorrientePage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [errorCatalogos, setErrorCatalogos] = useState<string | null>(null);

  const [proveedorId, setProveedorId] = useState("");
  const [formaPagoId, setFormaPagoId] = useState("");

  const [cuenta, setCuenta] = useState<CuentaCorriente | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [prov, metodos] = await Promise.all([
          api.get<Proveedor[]>("/proveedores?activos=true"),
          api.get<MetodoPago[]>("/metodos-pago?activos=true"),
        ]);
        setProveedores(prov);
        setMetodosPago(metodos);
      } catch (err) {
        setErrorCatalogos(
          err instanceof ApiError ? err.message : "No se pudieron cargar los catálogos.",
        );
      }
    })();
  }, []);

  const cargarCuenta = useCallback(
    async (idProveedor: string) => {
      if (!idProveedor) {
        setCuenta(null);
        return;
      }

      setCargando(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (formaPagoId) params.set("formaPago", formaPagoId);
        const query = params.toString() ? `?${params.toString()}` : "";

        const data = await api.get<CuentaCorriente>(`/cuenta-corriente/${idProveedor}${query}`);
        setCuenta(data);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "No se pudo cargar la cuenta corriente del proveedor.",
        );
      } finally {
        setCargando(false);
      }
    },
    [formaPagoId],
  );

  useEffect(() => {
    cargarCuenta(proveedorId);
  }, [proveedorId, cargarCuenta]);

  const nombreProveedor = cuenta
    ? cuenta.supplier.supplier_trade_name ?? cuenta.supplier.supplier_legal_name
    : null;

  const saldoActual = cuenta ? Number(cuenta.saldo_actual) : 0;

  return (
    <>
      <PageHeader
        eyebrow=""
        titulo="Cuenta corriente de proveedores"
        descripcion=""
      />

      {errorCatalogos && (
        <div className="mb-6">
          <InfoBox tipo="error">{errorCatalogos}</InfoBox>
        </div>
      )}

      <Card
        titulo="Elegí un proveedor"
        descripcion="El saldo se actualiza solo, a partir de los comprobantes registrados y las órdenes de pago confirmadas."
      >
        <FieldGrid>
          <Field label="Proveedor" htmlFor="proveedor" requerido>
            <Select
              id="proveedor"
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
            >
              <option value="">Elegí un proveedor…</option>
              {proveedores.map((p) => (
                <option key={p.supplier_id} value={p.supplier_id}>
                  {p.supplier_trade_name ?? p.supplier_legal_name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Forma de pago"
            htmlFor="formaPago"
            ayuda="Muestra solo los pagos hechos con esa forma."
          >
            <Select
              id="formaPago"
              value={formaPagoId}
              onChange={(e) => setFormaPagoId(e.target.value)}
              disabled={!proveedorId}
            >
              <option value="">Todas las formas de pago</option>
              {metodosPago.map((m) => (
                <option key={m.payment_method_id} value={m.payment_method_id}>
                  {m.payment_method}
                </option>
              ))}
            </Select>
          </Field>
        </FieldGrid>
      </Card>

      {!proveedorId ? (
        <div className="mt-6">
          <Card>
            <EmptyState
              titulo="Elegí un proveedor"
              descripcion="Seleccioná un proveedor arriba para ver su saldo y el historial de comprobantes y pagos."
            />
          </Card>
        </div>
      ) : (
        <>
          {cuenta && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-line bg-white p-4 shadow-card">
                <p className="text-xs uppercase tracking-wide text-carbon/60">Saldo actual</p>
                <p className="mt-1 font-serif text-2xl text-carbon">$ {plata(saldoActual)}</p>
                <div className="mt-2">
                  <Badge tono={cuenta.cuenta_al_dia ? "activo" : "alerta"}>
                    {cuenta.cuenta_al_dia ? "Cuenta al día" : "Con saldo pendiente"}
                  </Badge>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-white p-4 shadow-card">
                <p className="text-xs uppercase tracking-wide text-carbon/60">Total facturado</p>
                <p className="mt-1 font-serif text-2xl text-carbon">
                  $ {plata(cuenta.total_facturado)}
                </p>
              </div>

              <div className="rounded-xl border border-line bg-white p-4 shadow-card">
                <p className="text-xs uppercase tracking-wide text-carbon/60">Total pagado</p>
                <p className="mt-1 font-serif text-2xl text-carbon">
                  $ {plata(cuenta.total_pagado)}
                </p>
              </div>

              <div className="rounded-xl border border-line bg-white p-4 shadow-card">
                <p className="text-xs uppercase tracking-wide text-carbon/60">
                  Comprobantes pendientes
                </p>
                <p className="mt-1 font-serif text-2xl text-carbon">
                  {cuenta.comprobantes_pendientes}
                </p>
              </div>
            </div>
          )}

          <div className="mt-6">
            <Card
              titulo={nombreProveedor ? `Movimientos de ${nombreProveedor}` : "Movimientos"}
              descripcion="Comprobantes recibidos y pagos confirmados, del más reciente al más antiguo."
            >
              {error && (
                <div className="mb-4">
                  <InfoBox tipo="error">{error}</InfoBox>
                </div>
              )}

              {cargando ? (
                <p className="py-10 text-center text-sm text-carbon/50">
                  Cargando cuenta corriente…
                </p>
              ) : !cuenta || cuenta.movimientos.length === 0 ? (
                <EmptyState
                  titulo="No hay movimientos"
                  descripcion="Este proveedor todavía no tiene comprobantes ni pagos registrados en el sistema."
                />
              ) : (
                <Table className="min-w-[72rem]">
                  <THead>
                    <TH className="whitespace-nowrap">Fecha</TH>
                    <TH>Movimiento</TH>
                    <TH className="whitespace-nowrap">Forma de pago</TH>
                    <TH className="whitespace-nowrap">Referencia</TH>
                    <TH className="text-right whitespace-nowrap">Debe</TH>
                    <TH className="text-right whitespace-nowrap">Haber</TH>
                    <TH className="text-right whitespace-nowrap">Saldo</TH>
                    <TH className="whitespace-nowrap text-center">Estado</TH>
                  </THead>
                  <TBody>
                    {cuenta.movimientos.map((m) => {
                      const estadoLabel = m.voucher
                        ? m.voucher.voucher_status
                        : m.payment
                          ? "PAGO CONFIRMADO"
                          : "—";
                      const estadoTono = m.voucher
                        ? ESTADO_COMPROBANTE_TONO[m.voucher.voucher_status]
                        : "activo";

                      return (
                        <TR key={m.account_movement_id}>
                          <TD className="whitespace-nowrap">{fecha(m.movement_date)}</TD>
                          <TD className="min-w-[200px]">
                            {m.concept}
                            {m.voucher?.is_overdue && (
                              <span className="ml-2 inline-block">
                                <Badge tono="alerta">Vencido</Badge>
                              </span>
                            )}
                          </TD>
                          <TD className="whitespace-nowrap">{m.payment?.payment_method ?? "—"}</TD>
                          <TD className="whitespace-nowrap">{m.payment?.payment_reference || "—"}</TD>
                          <TD className="whitespace-nowrap text-right tabular-nums">
                            {Number(m.debit) ? `$ ${plata(m.debit)}` : "—"}
                          </TD>
                          <TD className="whitespace-nowrap text-right tabular-nums">
                            {Number(m.credit) ? `$ ${plata(m.credit)}` : "—"}
                          </TD>
                          <TD className="whitespace-nowrap text-right font-medium tabular-nums">
                            $ {plata(m.balance)}
                          </TD>
                          <TD className="whitespace-nowrap text-center">
                            <Badge tono={estadoTono}>{estadoLabel}</Badge>
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}