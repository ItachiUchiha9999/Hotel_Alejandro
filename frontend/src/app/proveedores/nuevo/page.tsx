"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Button, Card, CardFooter, Field, FieldGrid, InfoBox, Input, Select,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";

interface CondicionFiscal {
  tax_condition_id: number;
  tax_condition_name: string;
}

export default function NuevoProveedorPage() {
  const [condicionesFiscales, setCondicionesFiscales] = useState<CondicionFiscal[]>([]);
  const [cargandoCondiciones, setCargandoCondiciones] = useState(true);

  const [razonSocial, setRazonSocial] = useState("");
  const [nombreFantasia, setNombreFantasia] = useState("");
  const [cuit, setCuit] = useState("");
  const [condicionFiscalId, setCondicionFiscalId] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [domicilio, setDomicilio] = useState("");

  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<any>("/condiciones-fiscales?activas=true");
        const lista = Array.isArray(res) ? res : res?.data;
        if (Array.isArray(lista)) setCondicionesFiscales(lista);
      } catch {
        setErrorForm("No se pudieron cargar las condiciones fiscales.");
      } finally {
        setCargandoCondiciones(false);
      }
    })();
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErrorForm(null);

    if (!razonSocial.trim()) return setErrorForm("La razón social es obligatoria.");
    if (!cuit.trim()) return setErrorForm("El CUIT es obligatorio.");

    setGuardando(true);
    try {
      await api.post("/proveedores", {
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
      setErrorForm(err instanceof ApiError ? err.message : "No se pudo crear el proveedor.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="p-6">
      <PageHeader titulo="Nuevo proveedor" descripcion="" />

      <Card>
        <form onSubmit={guardar} className="space-y-6">
          <FieldGrid>
            <Field label="Razón Social" htmlFor="razonSocial" requerido>
              <Input
                id="razonSocial"
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
                placeholder="Ej. Distribuidora Hotelera S.R.L."
              />
            </Field>

            <Field label="Nombre de Fantasía" htmlFor="nombreFantasia" ayuda="Opcional">
              <Input
                id="nombreFantasia"
                value={nombreFantasia}
                onChange={(e) => setNombreFantasia(e.target.value)}
                placeholder="Ej. La Salteña Limpieza"
              />
            </Field>

            <Field label="CUIT" htmlFor="cuit" requerido ayuda="11 dígitos numéricos sin guiones">
              <Input
                id="cuit"
                value={cuit}
                onChange={(e) => setCuit(e.target.value)}
                placeholder="20123456789"
              />
            </Field>

            <Field label="Condición Fiscal" htmlFor="condicionFiscal">
              <Select
                id="condicionFiscal"
                value={condicionFiscalId}
                onChange={(e) => setCondicionFiscalId(e.target.value)}
                disabled={cargandoCondiciones}
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
                placeholder="contacto@proveedor.com"
              />
            </Field>

            <Field label="Teléfono" htmlFor="telefono">
              <Input
                id="telefono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+54 387 1234567"
              />
            </Field>

            <Field label="Domicilio" htmlFor="domicilio" className="md:col-span-2">
              <Input
                id="domicilio"
                value={domicilio}
                onChange={(e) => setDomicilio(e.target.value)}
                placeholder="Av. Belgrano 1234, Salta"
              />
            </Field>
          </FieldGrid>

          {errorForm && <InfoBox tipo="error">{errorForm}</InfoBox>}
          {exito && <InfoBox tipo="exito">Proveedor creado. Cerrando ventana…</InfoBox>}

          <CardFooter>
            <Button type="button" variante="secundario" onClick={() => window.close()}>
              Cancelar
            </Button>
            <Button type="submit" cargando={guardando} disabled={exito}>
              Crear proveedor
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}