"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, CardFooter, Field, InfoBox, Input, Select } from "@/components/ui";
import { api } from "@/lib/api";
import type { Habitacion, TipoHabitacion } from "@/lib/types";

interface HabitacionFormProps {
  /** Solo los tipos activos: un tipo inactivo no se puede asignar. */
  tiposActivos: TipoHabitacion[];
  onRegistrada: (habitacion: Habitacion) => void | Promise<void>;
}

interface Errores {
  numero?: string;
  tipo?: string;
}

/** Mismo criterio que el backend: letras, números y guion, hasta 10 caracteres. */
const NUMERO_VALIDO = /^[A-Z0-9][A-Z0-9-]{0,9}$/;

/** Formulario de alta de habitaciones (HAB-01). El estado inicial siempre es Disponible. */
export function HabitacionForm({ tiposActivos, onRegistrada }: HabitacionFormProps) {
  const [numero, setNumero] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const sinTipos = tiposActivos.length === 0;

  const registrar = async (e: FormEvent) => {
    e.preventDefault();
    setErrorServidor(null);

    const nuevos: Errores = {};
    if (!NUMERO_VALIDO.test(numero.trim().toUpperCase())) {
      nuevos.numero =
        "Usá letras, números o guion, hasta 10 caracteres. Por ejemplo, 101 o 2-A.";
    }
    if (!tipoId) nuevos.tipo = "Elegí el tipo de habitación.";
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    setGuardando(true);
    try {
      const creada = await api.post<Habitacion>("/habitaciones", {
        room_number: numero.trim().toUpperCase(),
        room_type_id: Number(tipoId),
      });
      // Se conserva el tipo elegido: es habitual cargar varias habitaciones seguidas.
      setNumero("");
      await onRegistrada(creada);
    } catch (err) {
      setErrorServidor(err instanceof Error ? err.message : "No se pudo registrar la habitación.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={registrar} noValidate className="flex flex-col gap-5">
      <InfoBox tipo="regla">
        Toda habitación nueva se registra como Disponible.
      </InfoBox>

      {sinTipos && (
        <InfoBox tipo="error">
          No hay tipos de habitación activos.{" "}
          <Link href="/habitaciones/tipos" className="font-semibold underline">
            Cargá o activá un tipo en el catálogo
          </Link>{" "}
          para poder registrar habitaciones.
        </InfoBox>
      )}

      <Field label="Número de habitación" htmlFor="hab-numero" requerido error={errores.numero}>
        <Input
          id="hab-numero"
          value={numero}
          maxLength={10}
          placeholder="Por ejemplo, 101"
          disabled={sinTipos}
          invalido={Boolean(errores.numero)}
          onChange={(e) => setNumero(e.target.value)}
        />
      </Field>

      <Field label="Tipo de habitación" htmlFor="hab-tipo" requerido error={errores.tipo}>
        <Select
          id="hab-tipo"
          value={tipoId}
          disabled={sinTipos}
          invalido={Boolean(errores.tipo)}
          onChange={(e) => setTipoId(e.target.value)}
        >
          <option value="">Elegí un tipo</option>
          {tiposActivos.map((tipo) => (
            <option key={tipo.room_type_id} value={tipo.room_type_id}>
              {tipo.room_type_name} · hasta {tipo.room_type_max_capacity}{" "}
              {tipo.room_type_max_capacity === 1 ? "persona" : "personas"}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Estado inicial" htmlFor="hab-estado" ayuda="Lo define el sistema.">
        <Input id="hab-estado" value="Disponible" readOnly disabled />
      </Field>

      {errorServidor && <InfoBox tipo="error">{errorServidor}</InfoBox>}

      <CardFooter>
        <Button type="submit" cargando={guardando} disabled={sinTipos}>
          Registrar habitación
        </Button>
      </CardFooter>
    </form>
  );
}
