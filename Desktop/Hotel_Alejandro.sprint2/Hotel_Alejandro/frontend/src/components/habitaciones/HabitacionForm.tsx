"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, CardFooter, Field, InfoBox, Input, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Habitacion, TipoHabitacion } from "@/lib/types";

type EstadoInicial = "DISPONIBLE" | "MANTENIMIENTO";

interface Props {
  /** Si viene, el formulario edita esa habitación; si es null, registra una nueva. */
  habitacion: Habitacion | null;
  /** Tipos ya filtrados por la página (activos + el actual al editar). */
  tipos: TipoHabitacion[];
  /** true cuando el hotel todavía no tiene ningún tipo activo cargado. */
  sinTiposActivos: boolean;
  onGuardado: (mensaje: string) => void;
  onCancelar: () => void;
}

/**
 * Formulario de habitaciones (HAB-01).
 * El estado inicial solo se elige al crear: después lo maneja el ciclo de
 * mantenimiento (HAB-06) y los check-in / check-out.
 */
export function HabitacionForm({ habitacion, tipos, sinTiposActivos, onGuardado, onCancelar }: Props) {
  const esEdicion = habitacion !== null;

  const [numero, setNumero] = useState(habitacion?.room_number ?? "");
  const [tipoId, setTipoId] = useState(habitacion ? String(habitacion.room_type_id) : "");
  const [estado, setEstado] = useState<EstadoInicial>(
    habitacion?.room_state === "MANTENIMIENTO" ? "MANTENIMIENTO" : "DISPONIBLE",
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!numero.trim()) return setError("Ingresá el número de la habitación.");
    if (!tipoId) return setError("Seleccioná un tipo de habitación.");

    setGuardando(true);
    try {
      const base = { room_number: numero.trim(), room_type_id: Number(tipoId) };

      if (esEdicion) {
        await api.put(`/habitaciones/${habitacion.room_id}`, base);
      } else {
        await api.post("/habitaciones", { ...base, room_state: estado });
        setNumero("");
        setTipoId("");
        setEstado("DISPONIBLE");
      }
      onGuardado(esEdicion ? "Habitación actualizada." : "Habitación registrada.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la habitación.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-5" noValidate>
      {sinTiposActivos && (
        <InfoBox tipo="regla" titulo="Antes de registrar habitaciones:">
          no hay tipos de habitación activos. Creá uno en{" "}
          <Link href="/habitaciones/tipos" className="underline underline-offset-2">
            Tipos de habitación
          </Link>
          .
        </InfoBox>
      )}

      <Field label="Número de habitación" htmlFor="hab-numero" requerido ayuda="No se puede repetir.">
        <Input
          id="hab-numero"
          value={numero}
          maxLength={10}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="101"
          invalido={Boolean(error) && !numero.trim()}
        />
      </Field>

      <Field label="Tipo de habitación" htmlFor="hab-tipo" requerido>
        <Select
          id="hab-tipo"
          value={tipoId}
          onChange={(e) => setTipoId(e.target.value)}
          invalido={Boolean(error) && !tipoId}
        >
          <option value="">Seleccioná un tipo…</option>
          {tipos.map((t) => (
            <option key={t.room_type_id} value={t.room_type_id}>
              {t.room_type_name} (hasta {t.room_type_max_capacity} pers.)
              {t.room_type_state ? "" : " — inactivo"}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Estado inicial"
        htmlFor="hab-estado"
        ayuda={esEdicion ? "El estado se cambia desde mantenimiento/limpieza, check-in y check-out." : undefined}
      >
        <Select
          id="hab-estado"
          value={estado}
          disabled={esEdicion}
          onChange={(e) => setEstado(e.target.value as EstadoInicial)}
        >
          <option value="DISPONIBLE">Disponible</option>
          <option value="MANTENIMIENTO">Mantenimiento/Limpieza</option>
        </Select>
      </Field>

      {error && <InfoBox tipo="error">{error}</InfoBox>}

      <CardFooter>
        {esEdicion && (
          <Button type="button" variante="secundario" onClick={onCancelar}>
            Cancelar
          </Button>
        )}
        <Button type="submit" cargando={guardando} disabled={sinTiposActivos && !esEdicion}>
          {esEdicion ? "Guardar cambios" : "Registrar habitación"}
        </Button>
      </CardFooter>
    </form>
  );
}
