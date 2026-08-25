"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CardFooter, Field, FieldGrid, InfoBox, Input, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

interface Props {
  /** Si viene, el formulario edita ese depósito en lugar de crear uno nuevo. */
  deposito?: {
    deposit_id: number;
    deposit_name: string;
    deposit_location: string | null;
    deposit_state: boolean;
  };
}

export function DepositoForm({ deposito }: Props) {
  const router = useRouter();
  const esEdicion = Boolean(deposito);

  const [nombre, setNombre] = useState(deposito?.deposit_name ?? "");
  const [ubicacion, setUbicacion] = useState(deposito?.deposit_location ?? "");
  const [activo, setActivo] = useState(deposito?.deposit_state ?? true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombre.trim()) {
      setError("Ingresá el nombre del depósito.");
      return;
    }

    setGuardando(true);
    try {
      const cuerpo = {
        deposit_name: nombre.trim(),
        deposit_location: ubicacion.trim() || null,
        deposit_state: activo,
      };

      if (esEdicion) {
        await api.put(`/depositos/${deposito!.deposit_id}`, cuerpo);
      } else {
        await api.post("/depositos", cuerpo);
      }

      router.push("/stock/depositos");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el depósito.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-6">
      <FieldGrid>
        <Field label="Nombre" htmlFor="nombre" requerido>
          <Input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Depósito Central"
            invalido={Boolean(error) && !nombre.trim()}
          />
        </Field>

        <Field label="Ubicación" htmlFor="ubicacion" ayuda="Sector o piso donde está el depósito.">
          <Input
            id="ubicacion"
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            placeholder="Subsuelo - Sector Compras"
          />
        </Field>

        <Field label="Estado" htmlFor="estado">
          <Select
            id="estado"
            value={activo ? "activo" : "inactivo"}
            onChange={(e) => setActivo(e.target.value === "activo")}
          >
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </Select>
        </Field>
      </FieldGrid>

      <InfoBox tipo="regla" titulo="Regla del sistema:">
        un depósito inactivo no puede recibir ni entregar mercadería. El nombre no se
        puede repetir.
      </InfoBox>

      {error && <InfoBox tipo="error">{error}</InfoBox>}

      <CardFooter>
        <Button type="button" variante="secundario" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando}>
          {esEdicion ? "Guardar cambios" : "Crear depósito"}
        </Button>
      </CardFooter>
    </form>
  );
}
