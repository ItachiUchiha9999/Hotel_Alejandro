"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CardFooter, Field, FieldGrid, InfoBox, Input, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

interface CondicionFiscal {
  tax_condition_id: number;
  tax_condition_name: string;
}

export function ProveedorForm() {
  const router = useRouter();

  const [razonSocial, setRazonSocial] = useState("");
  const [nombreFantasia, setNombreFantasia] = useState("");
  const [cuit, setCuit] = useState("");
  const [condicionFiscalId, setCondicionFiscalId] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [domicilio, setDomicilio] = useState("");

  const [condicionesFiscales, setCondicionesFiscales] = useState<CondicionFiscal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    // Se solicitan únicamente las condiciones activas
    api.get<{ ok?: boolean; data?: CondicionFiscal[] }>("/condiciones-fiscales?activas=true")
      .then((res: any) => {
        const lista = Array.isArray(res) ? res : res?.data;
        if (Array.isArray(lista)) {
          setCondicionesFiscales(lista);
        }
      })
      .catch((err) => {
        console.error("Error al cargar condiciones fiscales:", err);
      });
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!razonSocial.trim()) {
      setError("Ingresá la razón social del proveedor.");
      return;
    }

    if (!cuit.trim()) {
      setError("Ingresá el CUIT del proveedor.");
      return;
    }

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

      // Redirige al listado tras crear exitosamente
      router.push("/proveedores/comprobantes");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el proveedor.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-6">
      <FieldGrid>
        <Field label="Razón Social" htmlFor="razonSocial" requerido>
          <Input
            id="razonSocial"
            value={razonSocial}
            onChange={(e) => setRazonSocial(e.target.value)}
            placeholder="Ej. Distribuidora Hotelera S.R.L."
            invalido={Boolean(error) && !razonSocial.trim()}
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

        <Field label="CUIT" htmlFor="cuit" requerido ayuda="11 dígitos numéricos">
          <Input
            id="cuit"
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
            placeholder="20123456789"
            invalido={Boolean(error) && !cuit.trim()}
          />
        </Field>

        <Field label="Condición Fiscal" htmlFor="condicionFiscal">
          <Select
            id="condicionFiscal"
            value={condicionFiscalId}
            onChange={(e) => setCondicionFiscalId(e.target.value)}
          >
            <option value="">Seleccionar condición fiscal...</option>
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

        <Field label="Domicilio" htmlFor="domicilio">
          <Input
            id="domicilio"
            value={domicilio}
            onChange={(e) => setDomicilio(e.target.value)}
            placeholder="Av. Belgrano 1234, Salta"
          />
        </Field>
      </FieldGrid>

      <InfoBox tipo="regla" titulo="Regla del sistema:">
        El CUIT debe ser válido (11 dígitos con dígito verificador) y no puede repetirse con otro proveedor registrado.
      </InfoBox>

      {error && <InfoBox tipo="error">{error}</InfoBox>}

      <CardFooter>
        <Button type="button" variante="secundario" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando}>
          Crear proveedor
        </Button>
      </CardFooter>
    </form>
  );
}