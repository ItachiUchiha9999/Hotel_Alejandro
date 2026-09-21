"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import type { Comprobante, Proveedor, TipoComprobante } from "@/lib/types";

interface ComprobanteDetallado {
  voucher_id: number;
  voucher_number: string;
  voucher_point_of_sale: string | number;
  issue_date: string;
  due_date: string | null;
  total_amount: string | number;
  paid_amount: string | number;
  voucher_status: "PENDIENTE" | "PAGADO" | "ANULADO";
  observations: string | null;
  creation_date: string;
  items_facturados?: Array<{
    detail_id?: number;
    article_id?: number | null;
    item_description: string;
    quantity: string | number;
    unit_price: string | number;
    subtotal?: string | number;
  }> | null;
  suppliers: {
    supplier_id: number;
    supplier_legal_name: string;
    supplier_trade_name: string | null;
  };
  voucher_type: {
    voucher_type_id: number;
    voucher_type: string;
    description: string;
    sign: number;
    affects_account: boolean;
  };
  employees?: {
    employees_name: string;
    employees_lastname: string;
  } | null;
  purchase_order?: {
    purchase_order_id: number;
    purchase_order_number: string;
    total_amount: string | number;
    purchase_order_status: string;
    purchase_order_detail?: Array<{
      purchase_detail_id?: number;
      detail_id?: number;
      item_description: string;
      quantity: string | number;
      unit_price: string | number;
      subtotal?: string | number;
      articles?: {
        article_code: string;
        article_name: string;
      } | null;
    }>;
  } | null;
}

const tonoPorEstado = {
  PENDIENTE: "alerta",
  PAGADO: "activo",
  ANULADO: "inactivo",
} as const;

const plata = (valor: string | number) =>
  Number(valor || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const POR_PAGINA = 10;

const fecha = (valor: string | null) => {
  if (!valor) return "—";
  const d = new Date(valor);
  return d.toLocaleDateString("es-AR", { timeZone: "UTC" });
};

const fechaHora = (valor: string | null) => {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function ComprobantesPage() {
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);

  // Catálogos para los filtros
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [tipos, setTipos] = useState<TipoComprobante[]>([]);
  const [errorCatalogos, setErrorCatalogos] = useState<string | null>(null);

  // Filtros de backend
  const [proveedorId, setProveedorId] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [estado, setEstado] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  // Modal Ver Detalle de Factura
  const [comprobanteDetalle, setComprobanteDetalle] = useState<ComprobanteDetallado | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  const cargarCatalogos = useCallback(async () => {
    setErrorCatalogos(null);
    try {
      const [prov, tip] = await Promise.all([
        api.get<Proveedor[]>("/proveedores"),
        api.get<TipoComprobante[]>("/tipos-comprobante"),
      ]);
      setProveedores(prov);
      setTipos(tip);
    } catch (err) {
      setErrorCatalogos(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar los filtros de proveedor y tipo."
      );
    }
  }, []);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  const cargar = useCallback(
    async (signal?: AbortSignal) => {
      setCargando(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (proveedorId) params.set("proveedor", proveedorId);
        if (tipoId) params.set("tipo", tipoId);
        if (estado) params.set("estado", estado);
        if (desde) params.set("desde", desde);
        if (hasta) params.set("hasta", hasta);

        const query = params.toString();
        const data = await api.get<Comprobante[]>(
          `/comprobantes${query ? `?${query}` : ""}`,
          { signal }
        );

        if (signal?.aborted) return;
        setComprobantes(data);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar los comprobantes."
        );
      } finally {
        if (!signal?.aborted) setCargando(false);
      }
    },
    [proveedorId, tipoId, estado, desde, hasta]
  );

  useEffect(() => {
    const controller = new AbortController();
    setPagina(1);
    cargar(controller.signal);
    return () => controller.abort();
  }, [cargar]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return comprobantes;
    return comprobantes.filter((c) =>
      `${c.supplier_legal_name} ${c.supplier_trade_name ?? ""} ${c.voucher_type} ${c.voucher_full_number}`
        .toLowerCase()
        .includes(q)
    );
  }, [comprobantes, busqueda]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const visiblesPagina = useMemo(
    () =>
      visibles.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA),
    [visibles, paginaSegura]
  );
  const desdeItem =
    visibles.length === 0 ? 0 : (paginaSegura - 1) * POR_PAGINA + 1;
  const hastaItem = Math.min(paginaSegura * POR_PAGINA, visibles.length);

  const totalPendiente = useMemo(
    () =>
      visibles
        .filter((c) => c.voucher_status === "PENDIENTE")
        .reduce((acc, c) => acc + Number(c.pending_amount), 0),
    [visibles]
  );

  const hayFiltrosActivos = Boolean(
    proveedorId || tipoId || estado || desde || hasta || busqueda
  );

  const limpiarFiltros = () => {
    setProveedorId("");
    setTipoId("");
    setEstado("");
    setDesde("");
    setHasta("");
    setBusqueda("");
  };

  const verDetalle = async (voucherId: number) => {
    setCargandoDetalle(true);
    setErrorDetalle(null);
    try {
      const res = await api.get<any>(`/comprobantes/${voucherId}`);
      const data = res?.data ?? res;
      setComprobanteDetalle(data);
    } catch (err) {
      setErrorDetalle(
        err instanceof ApiError
          ? err.message
          : "No se pudo obtener el detalle del comprobante."
      );
    } finally {
      setCargandoDetalle(false);
    }
  };

  // Lista de renglones a renderizar: toma los ítems facturados específicos si existen;
  // si no, toma los de la orden vinculada como respaldo
  const renglonesMostrados = useMemo(() => {
    if (!comprobanteDetalle) return [];
    if (
      comprobanteDetalle.items_facturados &&
      comprobanteDetalle.items_facturados.length > 0
    ) {
      return comprobanteDetalle.items_facturados;
    }
    return comprobanteDetalle.purchase_order?.purchase_order_detail || [];
  }, [comprobanteDetalle]);

  return (
    <>
      <PageHeader
        eyebrow=""
        titulo="Comprobantes de proveedores"
        descripcion=""
        acciones={
          <Link href="/proveedores/comprobantes/nuevo">
            <Button>Registrar comprobante</Button>
          </Link>
        }
      />

      <Card>
        <div className="mb-5 space-y-4">
          {errorCatalogos && (
            <InfoBox tipo="error">
              {errorCatalogos}{" "}
              <button
                type="button"
                onClick={cargarCatalogos}
                className="underline underline-offset-2"
              >
                Reintentar
              </button>
            </InfoBox>
          )}

          <FieldGrid>
            <Field label="Proveedor" htmlFor="filtro-proveedor">
              <Select
                id="filtro-proveedor"
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
              >
                <option value="">Todos</option>
                {proveedores.map((p) => (
                  <option key={p.supplier_id} value={p.supplier_id}>
                    {p.supplier_trade_name ?? p.supplier_legal_name}
                    {!p.supplier_state ? " (inactivo)" : ""}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Tipo de comprobante" htmlFor="filtro-tipo">
              <Select
                id="filtro-tipo"
                value={tipoId}
                onChange={(e) => setTipoId(e.target.value)}
              >
                <option value="">Todos</option>
                {tipos.map((t) => (
                  <option key={t.voucher_type_id} value={t.voucher_type_id}>
                    {t.voucher_type.replaceAll("_", " ")}
                    {!t.active ? " (inactivo)" : ""}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Estado" htmlFor="filtro-estado">
              <Select
                id="filtro-estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="PAGADO">Pagado</option>
                <option value="ANULADO">Anulado</option>
              </Select>
            </Field>

            <Field label="Desde" htmlFor="filtro-desde">
              <Input
                id="filtro-desde"
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                max={hasta || undefined}
              />
            </Field>

            <Field label="Hasta" htmlFor="filtro-hasta">
              <Input
                id="filtro-hasta"
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                min={desde || undefined}
              />
            </Field>
          </FieldGrid>

          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="search"
              placeholder="Buscar por proveedor, tipo o número"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="max-w-sm"
            />

            <Button
              type="button"
              variante="secundario"
              tamano="sm"
              onClick={limpiarFiltros}
              disabled={!hayFiltrosActivos}
            >
              Limpiar filtros
            </Button>

            {totalPendiente > 0 && (
              <span className="ml-auto text-xs text-carbon/60">
                Pendiente de pago:{" "}
                <strong className="tabular-nums">
                  $ {plata(totalPendiente)}
                </strong>
              </span>
            )}
          </div>
        </div>

        {error && (
          <InfoBox tipo="error">
            {error}{" "}
            <button
              type="button"
              onClick={() => cargar()}
              className="underline underline-offset-2"
            >
              Reintentar
            </button>
          </InfoBox>
        )}

        {cargando ? (
          <p className="py-10 text-center text-sm text-carbon/50">
            Cargando comprobantes…
          </p>
        ) : visibles.length === 0 ? (
          <EmptyState
            titulo="No hay comprobantes registrados"
            descripcion={
              comprobantes.length === 0
                ? hayFiltrosActivos
                  ? "Ningún comprobante coincide con los filtros aplicados."
                  : "Cuando recibas una factura de un proveedor, registrala acá para que quede en su cuenta corriente."
                : "Ningún comprobante coincide con la búsqueda."
            }
            accion={
              comprobantes.length === 0 && !hayFiltrosActivos ? (
                <Link href="/proveedores/comprobantes/nuevo">
                  <Button>Registrar el primero</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <THead>
                <TH>Comprobante</TH>
                <TH>Proveedor</TH>
                <TH>Emisión</TH>
                <TH>Vencimiento</TH>
                <TH className="text-right">Total</TH>
                <TH className="text-right">Pagado</TH>
                <TH className="text-right">Pendiente</TH>
                <TH>Estado</TH>
                <TH className="text-right">Acciones</TH>
              </THead>
              <TBody>
                {visiblesPagina.map((c) => (
                  <TR key={c.voucher_id}>
                    <TD>
                      <button
                        type="button"
                        onClick={() => verDetalle(c.voucher_id)}
                        className="text-left font-medium underline decoration-carbon/25 underline-offset-4 hover:decoration-carbon"
                      >
                        {c.voucher_type.replaceAll("_", " ")}
                      </button>
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
                    <TD className="text-right tabular-nums">
                      $ {plata(c.total_amount)}
                    </TD>
                    <TD className="text-right tabular-nums">
                      $ {plata(c.paid_amount)}
                    </TD>
                    <TD className="text-right tabular-nums font-medium">
                      $ {plata(c.pending_amount)}
                    </TD>
                    <TD>
                      <Badge tono={tonoPorEstado[c.voucher_status]}>
                        {c.voucher_status}
                      </Badge>
                    </TD>
                    <TD className="text-right">
                      <button
                        type="button"
                        onClick={() => verDetalle(c.voucher_id)}
                        className="text-xs font-medium underline decoration-carbon/30 underline-offset-4 hover:decoration-carbon"
                      >
                        Ver detalle
                      </button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>

            {totalPaginas > 1 && (
              <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-line pt-4 sm:flex-row">
                <p className="text-xs text-carbon/50">
                  Mostrando {desdeItem}–{hastaItem} de {visibles.length}{" "}
                  comprobantes
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    disabled={paginaSegura === 1}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm text-carbon transition disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-mist/60"
                  >
                    Anterior
                  </button>
                  <span className="px-2 text-sm text-carbon/70">
                    Página {paginaSegura} de {totalPaginas}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPagina((p) => Math.min(totalPaginas, p + 1))
                    }
                    disabled={paginaSegura === totalPaginas}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm text-carbon transition disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-mist/60"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ========================================================
          MODAL FICHA / DETALLE DE COMPROBANTE
      ======================================================== */}
      {(comprobanteDetalle || cargandoDetalle || errorDetalle) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setComprobanteDetalle(null);
              setErrorDetalle(null);
            }
          }}
        >
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-carbon/10 bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-carbon/10 bg-white px-6 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon/45">
                  Ficha de Comprobante #{comprobanteDetalle?.voucher_id ?? "—"}
                </p>
                <h2 className="mt-1 text-lg font-semibold">
                  {comprobanteDetalle
                    ? `${comprobanteDetalle.voucher_type.voucher_type.replaceAll("_", " ")} ${String(
                        comprobanteDetalle.voucher_point_of_sale
                      ).padStart(4, "0")}-${String(
                        comprobanteDetalle.voucher_number
                      ).padStart(8, "0")}`
                    : "Cargando comprobante..."}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setComprobanteDetalle(null);
                  setErrorDetalle(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-carbon/40 hover:bg-carbon/5"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {cargandoDetalle ? (
                <p className="py-12 text-center text-sm text-carbon/50">
                  Cargando información del comprobante...
                </p>
              ) : errorDetalle ? (
                <InfoBox tipo="error">{errorDetalle}</InfoBox>
              ) : (
                comprobanteDetalle && (
                  <div className="space-y-6">
                    {/* ENCABEZADO Y ESTADO */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-carbon/10 bg-carbon/[0.025] p-3">
                      <div>
                        <p className="text-[10px] font-medium uppercase text-carbon/45">
                          Proveedor
                        </p>
                        <p className="text-sm font-semibold">
                          {comprobanteDetalle.suppliers.supplier_trade_name ??
                            comprobanteDetalle.suppliers.supplier_legal_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-medium uppercase text-carbon/45">
                          Estado comprobante
                        </p>
                        <div className="mt-0.5">
                          <Badge
                            tono={
                              tonoPorEstado[comprobanteDetalle.voucher_status]
                            }
                          >
                            {comprobanteDetalle.voucher_status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* DATOS GENERALES */}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-carbon/10 p-3">
                        <p className="text-[10px] uppercase text-carbon/45">
                          Fecha de Emisión
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {fecha(comprobanteDetalle.issue_date)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-carbon/10 p-3">
                        <p className="text-[10px] uppercase text-carbon/45">
                          Fecha de Vencimiento
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {fecha(comprobanteDetalle.due_date)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-carbon/10 p-3">
                        <p className="text-[10px] uppercase text-carbon/45">
                          Orden de Compra Vinculada
                        </p>
                        <p className="mt-1 font-mono text-sm font-semibold text-carbon">
                          {comprobanteDetalle.purchase_order
                            ? comprobanteDetalle.purchase_order
                                .purchase_order_number
                            : "—"}
                        </p>
                      </div>
                    </div>

                    {/* IMPORTES Y SALDOS */}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-carbon/10 p-3">
                        <p className="text-[10px] uppercase text-carbon/45">
                          Total Comprobante
                        </p>
                        <p className="mt-1 text-lg font-bold text-carbon">
                          $ {plata(comprobanteDetalle.total_amount)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-carbon/10 p-3">
                        <p className="text-[10px] uppercase text-carbon/45">
                          Importe Pagado
                        </p>
                        <p className="mt-1 text-lg font-bold text-emerald-700">
                          $ {plata(comprobanteDetalle.paid_amount)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-carbon/10 p-3">
                        <p className="text-[10px] uppercase text-carbon/45">
                          Saldo Pendiente
                        </p>
                        <p className="mt-1 text-lg font-bold text-amber-700">
                          ${" "}
                          {plata(
                            Math.max(
                              0,
                              Number(comprobanteDetalle.total_amount) -
                                Number(comprobanteDetalle.paid_amount)
                            )
                          )}
                        </p>
                      </div>
                    </div>

                    {/* ARTÍCULOS EFECTIVAMENTE FACTURADOS */}
                    {renglonesMostrados.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-carbon/60">
                          {comprobanteDetalle.items_facturados
                            ? "Artículos facturados en este comprobante"
                            : `Artículos de la Orden ${
                                comprobanteDetalle.purchase_order
                                  ?.purchase_order_number ?? ""
                              }`}
                        </h3>
                        <div className="overflow-x-auto rounded-lg border border-carbon/10">
                          <Table>
                            <THead>
                              <TH>Descripción</TH>
                              <TH className="text-right">Cantidad</TH>
                              <TH className="text-right">Precio Unitario</TH>
                              <TH className="text-right">Subtotal</TH>
                            </THead>
                            <TBody>
                              {renglonesMostrados.map((item, idx) => {
                                const sub =
                                  item.subtotal !== undefined
                                    ? Number(item.subtotal)
                                    : Number(item.quantity || 0) *
                                      Number(item.unit_price || 0);

                                return (
                                  <TR
                                    key={
                                      item.purchase_detail_id ||
                                      item.detail_id ||
                                      idx
                                    }
                                  >
                                    <TD className="text-xs font-medium">
                                      {item.item_description}
                                    </TD>
                                    <TD className="text-right font-mono text-xs">
                                      {item.quantity}
                                    </TD>
                                    <TD className="text-right font-mono text-xs tabular-nums">
                                      $ {plata(item.unit_price)}
                                    </TD>
                                    <TD className="text-right font-mono text-xs font-semibold tabular-nums">
                                      $ {plata(sub)}
                                    </TD>
                                  </TR>
                                );
                              })}
                            </TBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* AUDITORÍA Y OBSERVACIONES */}
                    <div className="space-y-3 rounded-lg border border-carbon/10 bg-carbon/[0.015] p-4">
                      <div>
                        <p className="text-[10px] uppercase text-carbon/45">
                          Observaciones
                        </p>
                        <p className="mt-1 text-sm text-carbon/80">
                          {comprobanteDetalle.observations ||
                            "Sin observaciones registradas."}
                        </p>
                      </div>
                      <div className="grid gap-3 border-t border-carbon/10 pt-2 text-xs text-carbon/60 sm:grid-cols-2">
                        <div>
                          <span className="block text-[10px] uppercase text-carbon/40">
                            Registrado por
                          </span>
                          {comprobanteDetalle.employees
                            ? `${comprobanteDetalle.employees.employees_name} ${comprobanteDetalle.employees.employees_lastname}`
                            : "Sistema"}
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase text-carbon/40">
                            Fecha y Hora de Carga
                          </span>
                          {fechaHora(comprobanteDetalle.creation_date)}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        variante="secundario"
                        onClick={() => setComprobanteDetalle(null)}
                      >
                        Cerrar ficha
                      </Button>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}