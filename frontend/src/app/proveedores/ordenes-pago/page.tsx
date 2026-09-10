"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FieldGrid,
  InfoBox,
  Input,
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
  description: string;
  requires_reference: boolean;
  active: boolean;
}

interface ComprobantePendiente {
  voucher_id: number;
  voucher_number: string;
  voucher_point_of_sale: string | number;
  issue_date: string;
  total_amount: string | number;
  paid_amount: string | number;
  voucher_status: string;
  voucher_type?: {
    voucher_type: string;
    sign: number;
  };
}

interface DetalleImputacion {
  voucher_id: number;
  comprobante: ComprobantePendiente;
  saldo_pendiente: number;
  monto_a_pagar: string | number;
  seleccionado: boolean;
}

interface OrdenPago {
  payment_order_id: number;
  supplier_id: number;
  payment_method_id: number;
  payment_date: string;
  total_amount: string | number;
  payment_reference: string | null;
  payment_order_status: number; // 0: BORRADOR, 1: CONFIRMADA, 2: ANULADA
  observations: string | null;
  creation_date: string;
  confirmed_date: string | null;
  suppliers: {
    supplier_id: number;
    supplier_legal_name: string;
    supplier_trade_name: string | null;
    supplier_cuit: string;
  };
  payment_method: {
    payment_method_id: number;
    payment_method: string;
    description: string;
  };
  employees?: {
    employees_name: string;
    employees_lastname: string;
  };
  payment_order_detail: Array<{
    detail_id: number;
    applied_amount: string | number;
    supplier_voucher: {
      voucher_id: number;
      voucher_number: string;
      voucher_point_of_sale: string | number;
      issue_date: string;
      total_amount: string | number;
      paid_amount: string | number;
      voucher_type?: {
        voucher_type: string;
      };
    };
  }>;
}

/* ============================================================
   HELPERS
   ============================================================ */

const plata = (valor: string | number) =>
  Number(valor || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fecha = (valor: string | null) => {
  if (!valor) return "—";
  return new Date(valor).toLocaleDateString("es-AR", {
    timeZone: "UTC",
  });
};

const ESTADOS_MAP: Record<number, { label: string; tono: "alerta" | "activo" | "inactivo" }> = {
  0: { label: "BORRADOR", tono: "alerta" },
  1: { label: "CONFIRMADA", tono: "activo" },
  2: { label: "ANULADA", tono: "inactivo" },
};

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */

export default function OrdenesPagoPage() {
  const [ordenes, setOrdenes] = useState<OrdenPago[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Filtros
  const [filtroProveedor, setFiltroProveedor] = useState("");

  // Modal Crear Orden
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cargandoComprobantes, setCargandoComprobantes] = useState(false);

  const [supplierId, setSupplierId] = useState("");
  const [metodoId, setMetodoId] = useState("");
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().slice(0, 10));
  const [referencia, setReferencia] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [imputaciones, setImputaciones] = useState<DetalleImputacion[]>([]);

  // Modal Ver Detalle
  const [ordenDetalle, setOrdenDetalle] = useState<OrdenPago | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  /* ============================================================
     CARGA DE DATOS
     ============================================================ */

  const cargarCatalogos = useCallback(async () => {
    try {
      const [provRes, metodosRes] = await Promise.all([
        api.get<Proveedor[]>("/proveedores?activos=true"),
        api.get<MetodoPago[]>("/metodos-pago"),
      ]);

      setProveedores(provRes.filter((p) => p.supplier_state));
      setMetodosPago(metodosRes.filter((m) => m.active));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "No se pudieron cargar catálogos auxiliares."
      );
    }
  }, []);

  const cargarOrdenes = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const query = filtroProveedor ? `?proveedor=${filtroProveedor}` : "";
      const data = await api.get<OrdenPago[]>(`/ordenes-pago${query}`);
      setOrdenes(data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "No se pudieron cargar las órdenes de pago."
      );
    } finally {
      setCargando(false);
    }
  }, [filtroProveedor]);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  useEffect(() => {
    cargarOrdenes();
  }, [cargarOrdenes]);

  const cargarComprobantesProveedor = async (idProv: string) => {
    setSupplierId(idProv);
    setImputaciones([]);
    if (!idProv) return;

    setCargandoComprobantes(true);
    try {
      const pendientes = await api.get<ComprobantePendiente[]>(
        `/ordenes-pago/pendientes/${idProv}`
      );
      const items: DetalleImputacion[] = pendientes.map((c) => {
        const saldo = Number(c.total_amount) - Number(c.paid_amount);
        return {
          voucher_id: c.voucher_id,
          comprobante: c,
          saldo_pendiente: saldo,
          monto_a_pagar: String(saldo),
          seleccionado: false,
        };
      });
      setImputaciones(items);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "No se pudieron cargar las facturas pendientes."
      );
    } finally {
      setCargandoComprobantes(false);
    }
  };

  /* ============================================================
     GESTIÓN DE IMPUTACIÓN
     ============================================================ */

  const toggleSeleccion = (voucherId: number) => {
    setImputaciones((prev) =>
      prev.map((item) => {
        if (item.voucher_id !== voucherId) return item;
        const nuevoEstado = !item.seleccionado;
        return {
          ...item,
          seleccionado: nuevoEstado,
          monto_a_pagar:
            nuevoEstado && (!Number(item.monto_a_pagar) || item.monto_a_pagar === "0")
              ? String(item.saldo_pendiente)
              : item.monto_a_pagar,
        };
      })
    );
  };

  const actualizarMontoImputar = (voucherId: number, valor: string) => {
    const limpio = valor.replace(/,/g, ".").replace(/[^0-9.]/g, "");
    const partes = limpio.split(".");
    const normalizado = partes.length > 2 ? `${partes[0]}.${partes.slice(1).join("")}` : limpio;

    setImputaciones((prev) =>
      prev.map((item) => {
        if (item.voucher_id !== voucherId) return item;
        return {
          ...item,
          monto_a_pagar: normalizado,
          seleccionado: Number(normalizado) > 0,
        };
      })
    );
  };

  const totalPagar = useMemo(() => {
    return imputaciones
      .filter((i) => i.seleccionado)
      .reduce((acc, curr) => acc + (Number(curr.monto_a_pagar) || 0), 0);
  }, [imputaciones]);

  /* ============================================================
     GUARDAR / CONFIRMAR ORDEN
     ============================================================ */

  const limpiarFormulario = () => {
    setSupplierId("");
    setMetodoId("");
    setFechaPago(new Date().toISOString().slice(0, 10));
    setReferencia("");
    setObservaciones("");
    setImputaciones([]);
  };

  const cerrarFormulario = () => {
    if (guardando) return;
    setMostrarFormulario(false);
  };

  const procesarOrden = async (confirmarDirecto: boolean) => {
    setError(null);
    setMensaje(null);

    if (!supplierId) {
      setError("Seleccioná un proveedor.");
      return;
    }
    if (!metodoId) {
      setError("Seleccioná un método de pago.");
      return;
    }
    if (!fechaPago) {
      setError("Ingresá la fecha de pago.");
      return;
    }

    const seleccionados = imputaciones.filter((i) => i.seleccionado);

    if (seleccionados.length === 0) {
      setError("Tenés que seleccionar al menos un comprobante para imputar el pago.");
      return;
    }

    for (const item of seleccionados) {
      const montoNum = Number(item.monto_a_pagar) || 0;
      if (montoNum <= 0) {
        setError(
          `El comprobante ${item.comprobante.voucher_number} debe tener un importe a pagar mayor a cero.`
        );
        return;
      }
      if (montoNum > item.saldo_pendiente) {
        setError(
          `El importe en el comprobante ${item.comprobante.voucher_number} supera el saldo pendiente ($ ${item.saldo_pendiente}).`
        );
        return;
      }
    }

    setGuardando(true);

    try {
      // 1. Crear Cabecera Borrador
      const resBorrador: any = await api.post("/ordenes-pago", {
        supplierId: Number(supplierId),
        metodoId: Number(metodoId),
        fecha: fechaPago,
        referencia: referencia.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
      });

      // Extracción tolerante del ID (soporta respuesta anidada o plana)
      const nuevaOrdenId =
        resBorrador?.payment_order_id ??
        resBorrador?.data?.payment_order_id ??
        (typeof resBorrador === "number" ? resBorrador : null);

      if (!nuevaOrdenId) {
        throw new Error("No se pudo obtener el identificador de la orden creada.");
      }

      // 2. Asociar cada comprobante seleccionado
      for (const item of seleccionados) {
        const montoNum = Number(item.monto_a_pagar) || 0;
        await api.post(`/ordenes-pago/${nuevaOrdenId}/detalle`, {
          voucherId: item.voucher_id,
          importe: montoNum,
        });
      }

      // 3. Confirmar salida de dinero si corresponde
      if (confirmarDirecto) {
        await api.post(`/ordenes-pago/${nuevaOrdenId}/confirmar`, {});
      }

      // 4. Cerrar formulario y limpiar campos
      setMostrarFormulario(false);
      limpiarFormulario();

      setMensaje(
        confirmarDirecto
          ? "Orden de pago confirmada con éxito. Saldos de proveedor actualizados."
          : "Orden de pago guardada como borrador con los comprobantes imputados."
      );

      // 5. Refrescar listado
      await cargarOrdenes();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Ocurrió un error al registrar la orden."
      );
    } finally {
      setGuardando(false);
    }
  };

  /* ============================================================
     VER DETALLE Y ACCIONES
     ============================================================ */

  const verDetalle = async (id: number) => {
    setCargandoDetalle(true);
    try {
      const data = await api.get<OrdenPago>(`/ordenes-pago/${id}`);
      setOrdenDetalle(data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "No se pudo consultar el comprobante."
      );
    } finally {
      setCargandoDetalle(false);
    }
  };

  const confirmarOrdenBorrador = async (id: number) => {
    setError(null);
    setMensaje(null);
    try {
      await api.post(`/ordenes-pago/${id}/confirmar`, {});
      setMensaje("Orden de pago confirmada exitosamente.");
      if (ordenDetalle?.payment_order_id === id) {
        setOrdenDetalle(null);
      }
      await cargarOrdenes();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "No se pudo confirmar la orden de pago."
      );
    }
  };

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <>
      <PageHeader
        eyebrow="PROV-05 · TESORERÍA"
        titulo="Órdenes de pago"
        descripcion="Emisión de pagos a proveedores, imputación de facturas pendientes y egresos de caja."
        acciones={
          <Button
            onClick={() => {
              limpiarFormulario();
              setError(null);
              setMensaje(null);
              setMostrarFormulario(true);
            }}
          >
            Nueva orden de pago
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <InfoBox tipo="error">{error}</InfoBox>
        </div>
      )}

      {mensaje && (
        <div className="mb-4">
          <InfoBox tipo="exito">{mensaje}</InfoBox>
        </div>
      )}

      {/* ========================================================
          MODAL CREAR ORDEN DE PAGO
      ======================================================== */}
      {mostrarFormulario && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cerrarFormulario();
          }}
        >
          <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-carbon/10 bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-carbon/10 bg-white px-6 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon/45">
                  PROV-05 · TESORERÍA
                </p>
                <h2 className="mt-1 text-lg font-semibold">Nueva orden de pago</h2>
                <p className="mt-1 text-xs text-carbon/55">
                  Completá la cabecera y seleccioná las facturas a cancelar.
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarFormulario}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-carbon/40 hover:bg-carbon/5"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {/* CABECERA */}
              <FieldGrid>
                <Field label="Proveedor" htmlFor="supplier">
                  <Select
                    id="supplier"
                    value={supplierId}
                    onChange={(e) => cargarComprobantesProveedor(e.target.value)}
                  >
                    <option value="">Seleccionar proveedor</option>
                    {proveedores.map((p) => (
                      <option key={p.supplier_id} value={p.supplier_id}>
                        {p.supplier_trade_name ?? p.supplier_legal_name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Método de pago" htmlFor="metodo">
                  <Select
                    id="metodo"
                    value={metodoId}
                    onChange={(e) => setMetodoId(e.target.value)}
                  >
                    <option value="">Seleccionar método</option>
                    {metodosPago.map((m) => (
                      <option key={m.payment_method_id} value={m.payment_method_id}>
                        {m.payment_method}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Fecha de pago" htmlFor="fecha">
                  <Input
                    id="fecha"
                    type="date"
                    value={fechaPago}
                    onChange={(e) => setFechaPago(e.target.value)}
                  />
                </Field>

                <Field label="N° Referencia / Recibo" htmlFor="referencia">
                  <Input
                    id="referencia"
                    placeholder="Ej: TRANSF-98124 o Recibo X"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                  />
                </Field>
              </FieldGrid>

              {/* COMPROBANTES PENDIENTES */}
              <div className="mt-8 border-t border-carbon/10 pt-5">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold">Comprobantes pendientes de pago</h3>
                  <p className="text-xs text-carbon/55">
                    Seleccioná los comprobantes que querés cancelar con esta orden.
                  </p>
                </div>

                {cargandoComprobantes ? (
                  <p className="py-6 text-center text-xs text-carbon/50">
                    Buscando comprobantes pendientes...
                  </p>
                ) : !supplierId ? (
                  <div className="rounded-lg border border-dashed border-carbon/15 p-6 text-center text-xs text-carbon/40">
                    Elegí un proveedor arriba para visualizar sus facturas adeudadas.
                  </div>
                ) : imputaciones.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-carbon/15 p-6 text-center text-xs text-carbon/40">
                    Este proveedor no tiene comprobantes pendientes de pago.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <THead>
                        <TH className="w-10">Pagar</TH>
                        <TH>Comprobante</TH>
                        <TH>Emisión</TH>
                        <TH className="text-right">Total original</TH>
                        <TH className="text-right">Saldo pendiente</TH>
                        <TH className="text-right">Monto a cancelar</TH>
                      </THead>
                      <TBody>
                        {imputaciones.map((item) => (
                          <TR key={item.voucher_id}>
                            <TD>
                              <input
                                type="checkbox"
                                checked={item.seleccionado}
                                onChange={() => toggleSeleccion(item.voucher_id)}
                                className="h-4 w-4 rounded border-carbon/20 accent-carbon"
                              />
                            </TD>
                            <TD className="font-mono text-xs">
                              {item.comprobante.voucher_type?.voucher_type}{" "}
                              {String(item.comprobante.voucher_point_of_sale).padStart(4, "0")}-
                              {String(item.comprobante.voucher_number).padStart(8, "0")}
                            </TD>
                            <TD>{fecha(item.comprobante.issue_date)}</TD>
                            <TD className="text-right">$ {plata(item.comprobante.total_amount)}</TD>
                            <TD className="text-right font-medium">$ {plata(item.saldo_pendiente)}</TD>
                            <TD className="text-right">
                              <Input
                                disabled={!item.seleccionado}
                                className="w-32 text-right"
                                value={item.monto_a_pagar}
                                onChange={(e) =>
                                  actualizarMontoImputar(item.voucher_id, e.target.value)
                                }
                              />
                            </TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </div>
                )}

                <div className="mt-4 flex justify-end">
                  <div className="rounded-lg border border-carbon/10 bg-carbon/[0.025] px-5 py-3">
                    <p className="text-xs text-carbon/50">TOTAL A DESEMBOLSAR</p>
                    <p className="text-xl font-semibold">$ {plata(totalPagar)}</p>
                  </div>
                </div>
              </div>

              {/* OBSERVACIONES */}
              <div className="mt-5">
                <Field label="Observaciones" htmlFor="obs">
                  <textarea
                    id="obs"
                    rows={2}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    className="w-full rounded-lg border border-carbon/15 px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              {/* ACCIONES */}
              <div className="mt-6 flex justify-end gap-3 border-t border-carbon/10 pt-5">
                <Button variante="secundario" onClick={cerrarFormulario}>
                  Cancelar
                </Button>
                <Button
                  variante="secundario"
                  onClick={() => procesarOrden(false)}
                >
                  Guardar borrador
                </Button>
                <Button onClick={() => procesarOrden(true)}>
                  {guardando ? "Procesando..." : "Confirmar y emitir pago"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL DETALLE DE ORDEN
      ======================================================== */}
      {(ordenDetalle || cargandoDetalle) && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOrdenDetalle(null);
          }}
        >
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-carbon/10 bg-white shadow-xl">
            {cargandoDetalle && !ordenDetalle ? (
              <div className="p-10 text-center text-sm text-carbon/50">Cargando orden…</div>
            ) : (
              ordenDetalle && (
                <>
                  <div className="sticky top-0 z-10 flex items-start justify-between border-b border-carbon/10 bg-white px-6 py-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon/45">
                        Orden de pago #{ordenDetalle.payment_order_id}
                      </p>
                      <h2 className="mt-1 text-xl font-semibold">
                        {ordenDetalle.suppliers.supplier_trade_name ??
                          ordenDetalle.suppliers.supplier_legal_name}
                      </h2>
                      <div className="mt-2">
                        <Badge
                          tono={
                            ESTADOS_MAP[ordenDetalle.payment_order_status]?.tono ?? "alerta"
                          }
                        >
                          {ESTADOS_MAP[ordenDetalle.payment_order_status]?.label ?? "DESCONOCIDO"}
                        </Badge>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOrdenDetalle(null)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-carbon/40 hover:bg-carbon/5"
                    >
                      ×
                    </button>
                  </div>

                  <div className="p-6">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-carbon/10 p-3">
                        <p className="text-[10px] uppercase text-carbon/45">Fecha de pago</p>
                        <p className="mt-1 text-sm font-medium">
                          {fecha(ordenDetalle.payment_date)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-carbon/10 p-3">
                        <p className="text-[10px] uppercase text-carbon/45">Método</p>
                        <p className="mt-1 text-sm font-medium">
                          {ordenDetalle.payment_method?.payment_method}
                        </p>
                      </div>
                      <div className="rounded-lg border border-carbon/10 p-3">
                        <p className="text-[10px] uppercase text-carbon/45">Referencia</p>
                        <p className="mt-1 text-sm font-medium">
                          {ordenDetalle.payment_reference || "—"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6">
                      <h3 className="mb-3 text-sm font-semibold">Comprobantes cancelados</h3>
                      {ordenDetalle.payment_order_detail.length === 0 ? (
                        <p className="text-xs text-carbon/45">No hay comprobantes asociados.</p>
                      ) : (
                        <Table>
                          <THead>
                            <TH>Comprobante</TH>
                            <TH>Fecha</TH>
                            <TH className="text-right">Total Factura</TH>
                            <TH className="text-right">Importe Aplicado</TH>
                          </THead>
                          <TBody>
                            {ordenDetalle.payment_order_detail.map((d) => (
                              <TR key={d.detail_id}>
                                <TD className="font-mono text-xs">
                                  {d.supplier_voucher?.voucher_type?.voucher_type}{" "}
                                  {String(d.supplier_voucher?.voucher_point_of_sale || 0).padStart(4, "0")}-
                                  {String(d.supplier_voucher?.voucher_number || 0).padStart(8, "0")}
                                </TD>
                                <TD>{fecha(d.supplier_voucher?.issue_date)}</TD>
                                <TD className="text-right">
                                  $ {plata(d.supplier_voucher?.total_amount)}
                                </TD>
                                <TD className="text-right font-medium">
                                  $ {plata(d.applied_amount)}
                                </TD>
                              </TR>
                            ))}
                          </TBody>
                        </Table>
                      )}

                      <div className="mt-4 flex justify-end">
                        <div className="rounded-lg bg-carbon/[0.04] px-5 py-3 text-right">
                          <p className="text-xs uppercase text-carbon/45">Total abonado</p>
                          <p className="mt-1 text-xl font-semibold">
                            $ {plata(ordenDetalle.total_amount)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                      <Button variante="secundario" onClick={() => setOrdenDetalle(null)}>
                        Cerrar
                      </Button>
                      {ordenDetalle.payment_order_status === 0 && (
                        <Button
                          onClick={() =>
                            confirmarOrdenBorrador(ordenDetalle.payment_order_id)
                          }
                        >
                          Confirmar orden ahora
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          LISTADO PRINCIPAL
      ======================================================== */}
      <Card>
        <div className="mb-5">
          <FieldGrid>
            <Field label="Filtrar por proveedor" htmlFor="filtroProv">
              <Select
                id="filtroProv"
                value={filtroProveedor}
                onChange={(e) => setFiltroProveedor(e.target.value)}
              >
                <option value="">Todos los proveedores</option>
                {proveedores.map((p) => (
                  <option key={p.supplier_id} value={p.supplier_id}>
                    {p.supplier_trade_name ?? p.supplier_legal_name}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldGrid>
        </div>

        {cargando ? (
          <p className="py-10 text-center text-sm text-carbon/50">Cargando órdenes de pago…</p>
        ) : ordenes.length === 0 ? (
          <EmptyState
            titulo="No hay órdenes de pago"
            descripcion="Emití pagos para cancelar la deuda de comprobantes pendientes."
            accion={
              <Button onClick={() => setMostrarFormulario(true)}>Nueva orden de pago</Button>
            }
          />
        ) : (
          <Table>
            <THead>
              <TH># Orden</TH>
              <TH>Proveedor</TH>
              <TH>Fecha Pago</TH>
              <TH>Método</TH>
              <TH className="text-right">Total Pagado</TH>
              <TH>Estado</TH>
              <TH>Acciones</TH>
            </THead>
            <TBody>
              {ordenes.map((orden) => {
                const conf = ESTADOS_MAP[orden.payment_order_status] ?? {
                  label: "DESCONOCIDO",
                  tono: "alerta",
                };

                return (
                  <TR key={orden.payment_order_id}>
                    <TD>
                      <button
                        type="button"
                        className="font-mono text-xs font-medium underline decoration-carbon/30 underline-offset-4 hover:decoration-carbon"
                        onClick={() => verDetalle(orden.payment_order_id)}
                      >
                        OP #{String(orden.payment_order_id).padStart(5, "0")}
                      </button>
                    </TD>
                    <TD>
                      {orden.suppliers.supplier_trade_name ??
                        orden.suppliers.supplier_legal_name}
                    </TD>
                    <TD>{fecha(orden.payment_date)}</TD>
                    <TD>{orden.payment_method?.payment_method}</TD>
                    <TD className="text-right font-medium">$ {plata(orden.total_amount)}</TD>
                    <TD>
                      <Badge tono={conf.tono}>{conf.label}</Badge>
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-xs font-medium underline"
                          onClick={() => verDetalle(orden.payment_order_id)}
                        >
                          Ver detalle
                        </button>
                        {orden.payment_order_status === 0 && (
                          <button
                            type="button"
                            className="text-xs font-medium text-gold-dark underline"
                            onClick={() => confirmarOrdenBorrador(orden.payment_order_id)}
                          >
                            Confirmar
                          </button>
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}