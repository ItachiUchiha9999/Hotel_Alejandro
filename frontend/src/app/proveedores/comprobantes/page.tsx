"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Badge, Button, Card, EmptyState, Field, FieldGrid, InfoBox, Input, Select,
  Table, THead, TH, TBody, TR, TD,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Comprobante, Proveedor, TipoComprobante } from "@/lib/types";

const tonoPorEstado = {
  PENDIENTE: "alerta",
  PAGADO: "activo",
  ANULADO: "inactivo",
} as const;

const plata = (valor: string | number) =>
  Number(valor).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * issue_date y due_date son columnas DATE en la base (sin hora): el backend
 * las devuelve como '2026-09-06T00:00:00.000Z', medianoche UTC. Si se
 * formatean con `new Date(valor).toLocaleDateString(...)`, el navegador las
 * convierte a la hora LOCAL antes de mostrarlas — en un huso horario detrás
 * de UTC (como Argentina, UTC-3), esa conversión resta horas y hace caer la
 * fecha mostrada un día antes del real (2026-09-06 se veía como 5/9/2026).
 * Por eso se leen los componentes en UTC (getUTC*) en vez de dejar que
 * toLocaleDateString aplique el huso horario del navegador.
 */
const fecha = (valor: string | null) => {
  if (!valor) return "—";
  const d = new Date(valor);
  return d.toLocaleDateString("es-AR", { timeZone: "UTC" });
};

/**
 * Listado de comprobantes registrados (PROV-01).
 *
 * PROV-04 — "Consultar y administrar comprobantes de un proveedor" agrega acá
 * los filtros combinables por proveedor, tipo, estado y rango de fechas: se
 * mandan como query params al backend (que ya los soporta), y la búsqueda de
 * texto libre se sigue resolviendo en el cliente sobre lo que devuelve el
 * backend. Los comprobantes ANULADOS (baja lógica) no se ocultan por
 * defecto: aparecen igual que cualquier otro estado, salvo que el filtro
 * Estado los excluya explícitamente.
 *
 * Cada cambio de filtro dispara un nuevo fetch. Como el usuario puede cambiar
 * varios filtros rápido (por ejemplo, tipear o seleccionar fechas seguidas),
 * pueden quedar varias requests en vuelo al mismo tiempo; sin cancelación, una
 * respuesta vieja que tarda más podía llegar después que una más nueva y
 * pisar la tabla con datos que ya no correspondían a los filtros elegidos.
 * Por eso `cargar` usa AbortController: cada corrida del efecto cancela la
 * request anterior, y cualquier respuesta de una request ya cancelada se
 * ignora en vez de aplicarse.
 */
export default function ComprobantesPage() {
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  // Catálogos para los selects de filtro. Se cargan una sola vez al montar,
  // no dependen de los filtros aplicados al listado.
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [tipos, setTipos] = useState<TipoComprobante[]>([]);
  const [errorCatalogos, setErrorCatalogos] = useState<string | null>(null);

  // Filtros que se resuelven en el backend.
  const [proveedorId, setProveedorId] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [estado, setEstado] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

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
        err instanceof ApiError ? err.message : "No se pudieron cargar los filtros de proveedor y tipo.",
      );
    }
  }, []);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  // Se vuelve a pedir el listado cada vez que cambia alguno de los filtros de
  // backend. El filtrado por estos campos ya NO se hace en el cliente.
  // Acepta un `signal` opcional para poder cancelarse desde el efecto de
  // abajo cuando los filtros cambian antes de que termine de responder.
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
          { signal },
        );

        // Si mientras esperábamos la respuesta ya se disparó una request más
        // nueva (otro cambio de filtro), esta quedó obsoleta: se descarta sin
        // tocar el estado, para no pisar lo que trajo la request vigente.
        if (signal?.aborted) return;

        setComprobantes(data);
      } catch (err) {
        // Una cancelación intencional (AbortError) no es un error real: no
        // hay que mostrar nada ni tocar el estado, la request vigente se
        // encarga de actualizar la pantalla.
        if (err instanceof DOMException && err.name === "AbortError") return;

        setError(err instanceof ApiError ? err.message : "No se pudieron cargar los comprobantes.");
      } finally {
        // No apagar el loading si esta request ya fue cancelada: dejamos que
        // la request vigente sea la que decida cuándo termina la carga.
        if (!signal?.aborted) setCargando(false);
      }
    },
    [proveedorId, tipoId, estado, desde, hasta],
  );

  useEffect(() => {
    const controller = new AbortController();
    cargar(controller.signal);
    return () => controller.abort();
  }, [cargar]);

  // Búsqueda de texto libre: sigue siendo en el cliente, sobre lo que ya
  // vino filtrado del backend.
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return comprobantes;
    return comprobantes.filter((c) =>
      `${c.supplier_legal_name} ${c.supplier_trade_name ?? ""} ${c.voucher_type} ${c.voucher_full_number}`
        .toLowerCase()
        .includes(q),
    );
  }, [comprobantes, busqueda]);

  // El resumen se calcula sobre lo visible (filtros de backend + búsqueda),
  // no sobre el total sin filtrar.
  const totalPendiente = useMemo(
    () =>
      visibles
        .filter((c) => c.voucher_status === "PENDIENTE")
        .reduce((acc, c) => acc + Number(c.pending_amount), 0),
    [visibles],
  );

  const hayFiltrosActivos = Boolean(
    proveedorId || tipoId || estado || desde || hasta || busqueda,
  );

  const limpiarFiltros = () => {
    setProveedorId("");
    setTipoId("");
    setEstado("");
    setDesde("");
    setHasta("");
    setBusqueda("");
    // No hace falta llamar a cargar() a mano: al vaciarse los filtros de
    // backend, el useEffect de arriba dispara el pedido sin query params.
  };

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
        <div className="mb-5 space-y-4">
          {errorCatalogos && (
            <InfoBox tipo="error">
              {errorCatalogos}{" "}
              <button type="button" onClick={cargarCatalogos} className="underline underline-offset-2">
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
              <Select id="filtro-tipo" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
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
              <Select id="filtro-estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
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
                Pendiente de pago: <strong className="tabular-nums">$ {plata(totalPendiente)}</strong>
              </span>
            )}
          </div>
        </div>

        {error && (
          <InfoBox tipo="error">
            {error}{" "}
            <button type="button" onClick={() => cargar()} className="underline underline-offset-2">
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
                  <TD className="text-right tabular-nums">$ {plata(c.paid_amount)}</TD>
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