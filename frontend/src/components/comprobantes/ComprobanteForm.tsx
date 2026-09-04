"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CardFooter, Field, FieldGrid, InfoBox, Input, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Proveedor, TipoComprobante } from "@/lib/types";

/**
 * Alta de comprobante de proveedor (PROV-01).
 *
 * El estado no se pide en el formulario: un comprobante nuevo siempre nace
 * PENDIENTE de pago, y a partir de ahí lo maneja el sistema según los pagos
 * que se le apliquen.
 */
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
      setProveedorId(String(prov[0].supplier_id));
      setTipoId(String(tip[0].voucher_type_id));
    } catch (err) {
      setErrorCarga(err instanceof ApiError ? err.message : "No se pudo preparar el formulario.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const tipo = useMemo(
    () => tipos.find((t) => String(t.voucher_type_id) === tipoId) ?? null,
    [tipos, tipoId],
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

    setGuardando(true);
    try {
      await api.post("/comprobantes", {
        supplier_id: Number(proveedorId),
        voucher_type_id: Number(tipoId),
        voucher_point_of_sale: puntoVenta.trim() || "0001",
        voucher_number: numero.trim(),
        issue_date: emision,
        due_date: vencimiento || null,
        total_amount: importeNum,
        observations: observaciones.trim() || null,
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
            onChange={(e) => setProveedorId(e.target.value)}
            disabled={bloqueado}
          >
            {proveedores.map((p) => (
              <option key={p.supplier_id} value={p.supplier_id}>
                {p.supplier_trade_name ?? p.supplier_legal_name} — {p.supplier_cuit}
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

        <Field label="Importe total" htmlFor="importe" requerido>
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

      <InfoBox tipo="regla" titulo="Reglas del sistema:">
        el comprobante queda registrado como pendiente de pago. No se puede repetir el
        mismo número y punto de venta para el mismo proveedor y tipo.
        {tipo && !tipo.affects_account && (
          <> Este tipo no mueve la cuenta corriente del proveedor.</>
        )}
      </InfoBox>

      {error && <InfoBox tipo="error">{error}</InfoBox>}

      <CardFooter>
        <Button type="button" variante="secundario" onClick={() => router.push("/proveedores/comprobantes")}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando} disabled={bloqueado}>
          Registrar comprobante
        </Button>
      </CardFooter>
    </form>
  );
}