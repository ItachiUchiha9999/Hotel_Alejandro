"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  CardFooter,
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
import type { Proveedor, TipoComprobante } from "@/lib/types";

interface DetalleOrdenCompra {
  purchase_detail_id: number;
  purchase_order_id: number;
  article_id: number | null;
  item_description: string;
  quantity: string | number;
  unit_price: string | number;
  subtotal: string | number;
  articles?: {
    article_id: number;
    article_code: string;
    article_name: string;
  } | null;
}

interface OrdenCompraAprobada {
  purchase_order_id: number;
  purchase_order_number: string;
  total_amount: string | number;
  issue_date: string;
  purchase_order_detail: DetalleOrdenCompra[];
}

interface ItemFacturaEditable {
  detail_id: number;
  article_id: number | null;
  article_code?: string;
  item_description: string;
  quantity_original: number;
  quantity: string | number;
  unit_price: string | number;
  incluido: boolean;
}

const plata = (valor: string | number) =>
  Number(valor || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function ComprobanteForm() {
  const router = useRouter();

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [tipos, setTipos] = useState<TipoComprobante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const hoy = new Date().toISOString().slice(0, 10);

  const [proveedorId, setProveedorId] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [puntoVenta, setPuntoVenta] = useState("0001");
  const [numero, setNumero] = useState("");
  const [emision, setEmision] = useState(hoy);
  const [vencimiento, setVencimiento] = useState("");
  const [importe, setImporte] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // Órdenes de compra aprobadas y renglones editables
  const [ordenesAprobadas, setOrdenesAprobadas] = useState<OrdenCompraAprobada[]>([]);
  const [cargandoOCs, setCargandoOCs] = useState(false);
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [itemsFactura, setItemsFactura] = useState<ItemFacturaEditable[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const [prov, tip] = await Promise.all([
        api.get<Proveedor[]>("/proveedores?activos=true"),
        api.get<TipoComprobante[]>("/tipos-comprobante?activos=true"),
      ]);

      if (prov.length === 0) throw new ApiError("No hay proveedores activos cargados.", 0);
      if (tip.length === 0) throw new ApiError("No hay tipos de comprobante configurados.", 0);

      setProveedores(prov);
      setTipos(tip);
      const defaultProvId = String(prov[0].supplier_id);
      setProveedorId(defaultProvId);
      setTipoId(String(tip[0].voucher_type_id));
      cargarOrdenesAprobadas(defaultProvId);
    } catch (err) {
      setErrorCarga(err instanceof ApiError ? err.message : "No se pudo preparar el formulario.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cargarOrdenesAprobadas = async (idProv: string) => {
    if (!idProv) {
      setOrdenesAprobadas([]);
      setPurchaseOrderId("");
      setItemsFactura([]);
      return;
    }

    setCargandoOCs(true);
    try {
      const res = await api.get<any>(`/comprobantes/ordenes-aprobadas/${idProv}`);
      const data = Array.isArray(res) ? res : res?.data || [];
      setOrdenesAprobadas(data);
      setPurchaseOrderId("");
      setItemsFactura([]);
    } catch {
      setOrdenesAprobadas([]);
      setPurchaseOrderId("");
      setItemsFactura([]);
    } finally {
      setCargandoOCs(false);
    }
  };

  const handleCambioProveedor = (nuevoId: string) => {
    setProveedorId(nuevoId);
    setPurchaseOrderId("");
    setItemsFactura([]);
    setImporte("");
    cargarOrdenesAprobadas(nuevoId);
  };

  const handleSeleccionarOC = (ocId: string) => {
    setPurchaseOrderId(ocId);
    if (!ocId) {
      setItemsFactura([]);
      setImporte("");
      return;
    }

    const oc = ordenesAprobadas.find((o) => String(o.purchase_order_id) === ocId);
    if (!oc) return;

    const items: ItemFacturaEditable[] = (oc.purchase_order_detail || []).map((d) => ({
      detail_id: d.purchase_detail_id,
      article_id: d.article_id,
      article_code: d.articles?.article_code,
      item_description: d.articles?.article_name || d.item_description,
      quantity_original: Number(d.quantity),
      quantity: Number(d.quantity),
      unit_price: Number(d.unit_price),
      incluido: true,
    }));

    setItemsFactura(items);

    const totalInicial = items.reduce(
      (acc, curr) => acc + Number(curr.quantity) * Number(curr.unit_price),
      0
    );
    setImporte(totalInicial.toFixed(2));
  };

  const actualizarItem = (
    detailId: number,
    campo: "quantity" | "unit_price" | "incluido",
    valor: any
  ) => {
    setItemsFactura((prev) => {
      const actualizados = prev.map((it) => {
        if (it.detail_id !== detailId) return it;
        return { ...it, [campo]: valor };
      });

      const totalRecalculado = actualizados
        .filter((i) => i.incluido)
        .reduce((acc, curr) => {
          const q = Number(curr.quantity) || 0;
          const p = Number(curr.unit_price) || 0;
          return acc + q * p;
        }, 0);

      setImporte(totalRecalculado.toFixed(2));
      return actualizados;
    });
  };

  const tipo = useMemo(
    () => tipos.find((t) => String(t.voucher_type_id) === tipoId) ?? null,
    [tipos, tipoId]
  );

  const bloqueado = cargando || Boolean(errorCarga);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!proveedorId) return setError("Elegí el proveedor.");
    if (!tipoId) return setError("Elegí el tipo de comprobante.");
    if (!numero.trim()) return setError("Ingresá el número del comprobante.");
    if (!emision) return setError("Ingresá la fecha de emisión.");

    const importeNum = Number(importe);
    if (!Number.isFinite(importeNum) || importeNum <= 0) {
      return setError("El importe total tiene que ser mayor a cero.");
    }
    if (vencimiento && vencimiento < emision) {
      return setError("La fecha de vencimiento no puede ser anterior a la de emisión.");
    }

    let itemsParaEnviar: any[] = [];
    if (purchaseOrderId && itemsFactura.length > 0) {
      const seleccionados = itemsFactura.filter((i) => i.incluido);
      if (seleccionados.length === 0) {
        return setError("Seleccioná al menos un ítem de la orden de compra para facturar.");
      }
      for (const item of seleccionados) {
        if (Number(item.quantity) <= 0) {
          return setError(`La cantidad de "${item.item_description}" debe ser mayor a cero.`);
        }
        if (Number(item.unit_price) < 0) {
          return setError(`El precio unitario de "${item.item_description}" no puede ser negativo.`);
        }
      }
      itemsParaEnviar = seleccionados.map((it) => ({
        detail_id: it.detail_id,
        article_id: it.article_id,
        article_code: it.article_code || null,
        item_description: it.item_description,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        subtotal: Number(it.quantity) * Number(it.unit_price),
      }));
    }

    setGuardando(true);
    try {
      await api.post("/comprobantes", {
        supplier_id: Number(proveedorId),
        voucher_type_id: Number(tipoId),
        purchase_order_id: purchaseOrderId ? Number(purchaseOrderId) : null,
        voucher_point_of_sale: puntoVenta.trim() || "0001",
        voucher_number: numero.trim(),
        issue_date: emision,
        due_date: vencimiento || null,
        total_amount: importeNum,
        observations: observaciones.trim() || null,
        items: itemsParaEnviar,
        items_facturados: itemsParaEnviar,
      });

      router.push("/proveedores/comprobantes");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el comprobante.");
    } finally {
      setGuardando(false);
    }
  }

  if (errorCarga) {
    return (
      <InfoBox tipo="error" titulo="No se pudo preparar el formulario:">
        {errorCarga}{" "}
        <button type="button" onClick={cargar} className="underline underline-offset-2">
          Reintentar
        </button>
      </InfoBox>
    );
  }

  return (
    <form onSubmit={guardar} className="space-y-6">
      <FieldGrid>
        <Field label="Proveedor" htmlFor="proveedor" requerido>
          <Select
            id="proveedor"
            value={proveedorId}
            onChange={(e) => handleCambioProveedor(e.target.value)}
            disabled={bloqueado}
          >
            {proveedores.map((p) => (
              <option key={p.supplier_id} value={p.supplier_id}>
                {p.supplier_trade_name ?? p.supplier_legal_name} — {p.supplier_cuit}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Orden de Compra vinculada"
          htmlFor="oc"
          ayuda={cargandoOCs ? "Buscando órdenes aprobadas..." : "Solo órdenes aprobadas por gerencia"}
        >
          <Select
            id="oc"
            value={purchaseOrderId}
            onChange={(e) => handleSeleccionarOC(e.target.value)}
            disabled={bloqueado || cargandoOCs}
          >
            <option value="">(Opcional) Sin orden de compra vinculada</option>
            {ordenesAprobadas.map((oc) => (
              <option key={oc.purchase_order_id} value={oc.purchase_order_id}>
                {oc.purchase_order_number} — $ {plata(oc.total_amount)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tipo de comprobante" htmlFor="tipo" requerido ayuda={tipo?.description}>
          <Select
            id="tipo"
            value={tipoId}
            onChange={(e) => setTipoId(e.target.value)}
            disabled={bloqueado}
          >
            {tipos.map((t) => (
              <option key={t.voucher_type_id} value={t.voucher_type_id}>
                {t.voucher_type.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Punto de venta" htmlFor="pv" ayuda="Los cuatro dígitos previos al número.">
          <Input
            id="pv"
            value={puntoVenta}
            onChange={(e) => setPuntoVenta(e.target.value)}
            disabled={bloqueado}
            className="font-mono"
            placeholder="0001"
          />
        </Field>

        <Field label="Número" htmlFor="numero" requerido ayuda="Por ejemplo: 00000123">
          <Input
            id="numero"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            disabled={bloqueado}
            className="font-mono"
          />
        </Field>

        <Field label="Fecha de emisión" htmlFor="emision" requerido>
          <Input
            id="emision"
            type="date"
            value={emision}
            onChange={(e) => setEmision(e.target.value)}
            disabled={bloqueado}
          />
        </Field>

        <Field label="Fecha de vencimiento" htmlFor="vencimiento" ayuda="Opcional.">
          <Input
            id="vencimiento"
            type="date"
            value={vencimiento}
            onChange={(e) => setVencimiento(e.target.value)}
            disabled={bloqueado}
          />
        </Field>

        <Field label="Importe total" htmlFor="importe" requerido ayuda="Calculado a partir de los ítems">
          <Input
            id="importe"
            type="number"
            min="0.01"
            step="0.01"
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            disabled={bloqueado}
            placeholder="0.00"
          />
        </Field>

        <Field label="Observaciones" htmlFor="obs" className="md:col-span-2">
          <Input
            id="obs"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            disabled={bloqueado}
            placeholder="Detalle de la compra o referencia interna"
          />
        </Field>
      </FieldGrid>

      {/* ITEMS DE LA ORDEN DE COMPRA SELECCIONADA */}
      {purchaseOrderId && itemsFactura.length > 0 && (
        <div className="rounded-xl border border-carbon/10 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">Ítems de la orden de compra a facturar</h3>
            <p className="text-xs text-carbon/55">
              Ajustá las cantidades facturadas o precios si la factura es parcial o difiere de la orden original.
            </p>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TH className="w-10">Facturar</TH>
                <TH>Descripción / Artículo</TH>
                <TH className="text-right">Cant. OC</TH>
                <TH className="w-28 text-right">Cant. Facturada</TH>
                <TH className="w-32 text-right">Precio Unitario ($)</TH>
                <TH className="text-right">Subtotal</TH>
              </THead>
              <TBody>
                {itemsFactura.map((item) => {
                  const sub = Number(item.quantity || 0) * Number(item.unit_price || 0);
                  return (
                    <TR key={item.detail_id}>
                      <TD>
                        <input
                          type="checkbox"
                          checked={item.incluido}
                          onChange={(e) =>
                            actualizarItem(item.detail_id, "incluido", e.target.checked)
                          }
                          className="h-4 w-4 rounded border-carbon/20 accent-carbon"
                        />
                      </TD>
                      <TD>
                        <span className="font-medium">{item.item_description}</span>
                      </TD>
                      <TD className="text-right font-mono text-xs text-carbon/55">
                        {item.quantity_original}
                      </TD>
                      <TD className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={!item.incluido}
                          className="text-right font-mono text-xs"
                          value={item.quantity}
                          onChange={(e) =>
                            actualizarItem(item.detail_id, "quantity", e.target.value)
                          }
                        />
                      </TD>
                      <TD className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={!item.incluido}
                          className="text-right font-mono text-xs"
                          value={item.unit_price}
                          onChange={(e) =>
                            actualizarItem(item.detail_id, "unit_price", e.target.value)
                          }
                        />
                      </TD>
                      <TD className="text-right font-medium">
                        $ {plata(item.incluido ? sub : 0)}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        </div>
      )}

      <InfoBox tipo="regla" titulo="Reglas del sistema:">
        el comprobante queda registrado como pendiente de pago. No se puede repetir el
        mismo número y punto de venta para el mismo proveedor y tipo.
        {tipo && !tipo.affects_account && (
          <> Este tipo no mueve la cuenta corriente del proveedor.</>
        )}
      </InfoBox>

      {error && <InfoBox tipo="error">{error}</InfoBox>}

      <CardFooter>
        <Button
          type="button"
          variante="secundario"
          onClick={() => router.push("/proveedores/comprobantes")}
        >
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando} disabled={bloqueado}>
          Registrar comprobante
        </Button>
      </CardFooter>
    </form>
  );
}