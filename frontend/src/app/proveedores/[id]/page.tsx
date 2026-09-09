"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Button, Card, CardFooter, Field, FieldGrid, InfoBox, Input, Select,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";

interface CondicionFiscal {
  tax_condition_id: number;
  tax_condition_name: string;
}

interface Proveedor {
  supplier_id: number;
  supplier_legal_name: string;
  supplier_trade_name: string | null;
  supplier_cuit: string;
  supplier_email: string | null;
  supplier_phone: string | null;
  supplier_address: string | null;
  tax_condition_id: number | null;
}

export default function EditarProveedorPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [condicionesFiscales, setCondicionesFiscales] = useState<CondicionFiscal[]>([]);
  const [cargando, setCargando] = useState(true);

  const [razonSocial, setRazonSocial] = useState("");
  const [nombreFantasia, setNombreFantasia] = useState("");
  const [cuit, setCuit] = useState("");
  const [condicionFiscalId, setCondicionFiscalId] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [domicilio, setDomicilio] = useState("");

  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [provRes, cfRes] = await Promise.all([
          api.get<any>(`/proveedores/${id}`),
          api.get<any>("/condiciones-fiscales?activas=true"),
        ]);

        const prov = provRes?.data ?? provRes;
        const cfs = Array.isArray(cfRes) ? cfRes : cfRes?.data;

        setProveedor(prov);
        setCondicionesFiscales(Array.isArray(cfs) ? cfs : []);

        setRazonSocial(prov.supplier_legal_name ?? "");
        setNombreFantasia(prov.supplier_trade_name ?? "");
        setCuit(prov.supplier_cuit ?? "");
        setCondicionFiscalId(prov.tax_condition_id ? String(prov.tax_condition_id) : "");
        setEmail(prov.supplier_email ?? "");
        setTelefono(prov.supplier_phone ?? "");
        setDomicilio(prov.supplier_address ?? "");
      } catch (err) {
        setErrorCarga(err instanceof ApiError ? err.message : "No se pudo cargar el proveedor.");
      } finally {
        setCargando(false);
      }
    })();
  }, [id]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErrorForm(null);

    if (!razonSocial.trim()) return setErrorForm("La razón social es obligatoria.");
    if (!cuit.trim()) return setErrorForm("El CUIT es obligatorio.");

    setGuardando(true);
    try {
      await api.put(`/proveedores/${id}`, {
        razonSocial: razonSocial.trim(),
        nombreFantasia: nombreFantasia.trim() || null,
        cuit: cuit.trim(),
        condicionFiscalId: condicionFiscalId ? Number(condicionFiscalId) : null,
        email: email.trim() || null,
        telefono: telefono.trim() || null,
        domicilio: domicilio.trim() || null,
      });

      try {
        new BroadcastChannel("proveedores_updates").postMessage({ type: "PROVEEDOR_UPDATED" });
      } catch {
        /* no crítico */
      }
      window.opener?.postMessage({ type: "PROVEEDOR_UPDATED" }, window.location.origin);

      setExito(true);
      setTimeout(() => window.close(), 900);
    } catch (err) {
      setErrorForm(err instanceof ApiError ? err.message : "No se pudo guardar el proveedor.");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <div className="p-6">
        <p className="py-10 text-center text-sm text-carbon/50">Cargando…</p>
      </div>
    );
  }

  if (errorCarga || !proveedor) {
    return (
      <div className="p-6">
        <InfoBox tipo="error">{errorCarga ?? "El proveedor no existe."}</InfoBox>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        titulo={`Ficha de ${proveedor.supplier_legal_name}`}
        descripcion="Los cambios impactan en el catálogo y en las pantallas de compras."
      />

      <Card>
        <form onSubmit={guardar} className="space-y-6">
          <FieldGrid>
            <Field label="CUIT" htmlFor="cuit" requerido ayuda="11 dígitos numéricos sin guiones">
              <Input
                id="cuit"
                value={cuit}
                onChange={(e) => setCuit(e.target.value)}
                placeholder="20123456789"
                className="font-mono"
              />
            </Field>

            <Field label="Razón Social" htmlFor="razonSocial" requerido>
              <Input
                id="razonSocial"
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
              />
            </Field>

            <Field label="Nombre de Fantasía" htmlFor="nombreFantasia" ayuda="Opcional">
              <Input
                id="nombreFantasia"
                value={nombreFantasia}
                onChange={(e) => setNombreFantasia(e.target.value)}
              />
            </Field>

            <Field label="Condición Fiscal" htmlFor="condicionFiscal">
              <Select
                id="condicionFiscal"
                value={condicionFiscalId}
                onChange={(e) => setCondicionFiscalId(e.target.value)}
              >
                <option value="">Elegir condición fiscal…</option>
                {condicionesFiscales.map((cf) => (
                  <option key={cf.tax_condition_id} value={cf.tax_condition_id}>
                    {cf.tax_condition_name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            <Field label="Teléfono" htmlFor="telefono">
              <Input
                id="telefono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </Field>

            <Field label="Domicilio" htmlFor="domicilio" className="md:col-span-2">
              <Input
                id="domicilio"
                value={domicilio}
                onChange={(e) => setDomicilio(e.target.value)}
              />
            </Field>
          </FieldGrid>

          {errorForm && <InfoBox tipo="error">{errorForm}</InfoBox>}
          {exito && <InfoBox tipo="exito">Cambios guardados. Cerrando ventana…</InfoBox>}

          <CardFooter>
            <Button type="button" variante="secundario" onClick={() => window.close()}>
              Cancelar
            </Button>
            <Button type="submit" cargando={guardando} disabled={exito}>
              Guardar cambios
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}