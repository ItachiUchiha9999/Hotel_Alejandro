"use client";

import { useState } from "react";
import { Button, CardFooter, Field, FieldGrid, InfoBox, Input, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { TIPO_BLOQUEO_UI, type HabitacionTablero, type TipoBloqueo } from "@/lib/housekeeping";

interface Props {
  habitacion: HabitacionTablero;
  onGuardado: () => void;
  onCancelar: () => void;
}

const hoyISO = () => new Date().toISOString().slice(0, 10);

/**
 * Alta de un bloqueo sobre una habitación (HU-9).
 *
 * Si la fecha de inicio es hoy, la habitación cambia de estado al guardar. Si
 * es a futuro, queda programado: la habitación sigue vendiéndose hasta ese día
 * y solo se bloquean las fechas del trabajo.
 */
export function BloqueoForm({ habitacion, onGuardado, onCancelar }: Props) {
  const [tipo, setTipo] = useState<TipoBloqueo>(
    habitacion.room_status === "OCUPADA" ? "MANTENIMIENTO" : "LIMPIEZA",
  );
  const [inicio, setInicio] = useState(hoyISO());
  const [finEstimado, setFinEstimado] = useState(hoyISO());
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const ocupada = habitacion.room_status === "OCUPADA";
  const empiezaHoy = inicio === hoyISO();

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (motivo.trim().length < 3) return setError("Indicá el motivo del bloqueo.");
    if (finEstimado < inicio) {
      return setError("La fecha de finalización no puede ser anterior a la de inicio.");
    }
    if (ocupada && empiezaHoy) {
      return setError("La habitación está ocupada. Programá el bloqueo para después del check-out.");
    }

    setGuardando(true);
    try {
      await api.post("/housekeeping", {
        room_id: habitacion.room_id,
        maintenance_type: tipo,
        start_date: inicio,
        estimated_end_date: finEstimado,
        reason: motivo.trim(),
      });
      onGuardado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el bloqueo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-5">
      <FieldGrid>
        <Field label="Tipo de bloqueo" htmlFor="tipo" requerido ayuda={TIPO_BLOQUEO_UI[tipo].ayuda}>
          <Select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoBloqueo)}>
            {(Object.keys(TIPO_BLOQUEO_UI) as TipoBloqueo[]).map((t) => (
              <option key={t} value={t}>
                {TIPO_BLOQUEO_UI[t].etiqueta}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Motivo" htmlFor="motivo" requerido>
          <Input
            id="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={tipo === "LIMPIEZA" ? "Limpieza profunda" : "Pérdida en la canilla del baño"}
          />
        </Field>

        <Field label="Desde" htmlFor="inicio" requerido>
          <Input
            id="inicio"
            type="date"
            min={hoyISO()}
            value={inicio}
            onChange={(e) => {
              setInicio(e.target.value);
              if (finEstimado < e.target.value) setFinEstimado(e.target.value);
            }}
          />
        </Field>

        <Field label="Hasta (estimado)" htmlFor="fin" requerido>
          <Input
            id="fin"
            type="date"
            min={inicio}
            value={finEstimado}
            onChange={(e) => setFinEstimado(e.target.value)}
          />
        </Field>
      </FieldGrid>

      {!empiezaHoy && (
        <InfoBox tipo="regla" titulo="Bloqueo programado:">
          la habitación sigue disponible hasta el {new Date(`${inicio}T00:00:00`).toLocaleDateString("es-AR")}.
          Solo se quitan de venta las fechas del trabajo.
        </InfoBox>
      )}

      {ocupada && (
        <InfoBox tipo="regla" titulo="Habitación ocupada:">
          no se puede bloquear mientras haya un huésped alojado. Programalo para una fecha posterior
          al check-out.
        </InfoBox>
      )}

      {error && <InfoBox tipo="error">{error}</InfoBox>}

      <CardFooter>
        <Button type="button" variante="secundario" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" cargando={guardando}>
          {empiezaHoy ? "Bloquear ahora" : "Programar bloqueo"}
        </Button>
      </CardFooter>
    </form>
  );
}
