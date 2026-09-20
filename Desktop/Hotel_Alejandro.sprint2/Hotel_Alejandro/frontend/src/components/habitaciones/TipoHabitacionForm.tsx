"use client";

import { useState, type FormEvent } from "react";
import { Button, CardFooter, Field, InfoBox, Input, Select } from "@/components/ui";
import { api } from "@/lib/api";
import type { TipoHabitacion } from "@/lib/types";

const CAPACIDAD_MAX = 20;

/** Misma apariencia que Input, para el campo de descripción (no hay Textarea compartido). */
const CLASE_TEXTAREA =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-carbon " +
  "placeholder:text-carbon/35 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/60";

interface TipoHabitacionFormProps {
  /** Tipo a editar; null para dar de alta uno nuevo. */
  tipo: TipoHabitacion | null;
  onGuardado: (mensaje: string) => void | Promise<void>;
  onCancelar: () => void;
}

interface Errores {
  nombre?: string;
  capacidad?: string;
}

/**
 * Formulario de alta y edición de tipos de habitación (HAB-03).
 * El padre lo monta con `key` distinta por tipo, así los campos arrancan con los
 * valores del tipo elegido sin necesidad de efectos.
 */
export function TipoHabitacionForm({ tipo, onGuardado, onCancelar }: TipoHabitacionFormProps) {
  const [nombre, setNombre] = useState(tipo?.room_type_name ?? "");
  const [descripcion, setDescripcion] = useState(tipo?.room_type_description ?? "");
  const [capacidad, setCapacidad] = useState(String(tipo?.room_type_max_capacity ?? 1));
  const [estado, setEstado] = useState(tipo && !tipo.room_type_state ? "inactivo" : "activo");
  const [errores, setErrores] = useState<Errores>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const validar = (): Errores => {
    const nuevos: Errores = {};
    if (nombre.trim().length < 2) {
      nuevos.nombre = "Escribí el nombre del tipo, de al menos 2 caracteres.";
    }
    const cantidad = Number(capacidad);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > CAPACIDAD_MAX) {
      nuevos.capacidad = `Ingresá un número entero entre 1 y ${CAPACIDAD_MAX}.`;
    }
    return nuevos;
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setErrorServidor(null);

    const nuevos = validar();
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    const datos = {
      room_type_name: nombre.trim(),
      room_type_description: descripcion.trim() || null,
      room_type_max_capacity: Number(capacidad),
      room_type_state: estado === "activo",
    };

    setGuardando(true);
    try {
      if (tipo) {
        await api.put(`/tipos-habitacion/${tipo.room_type_id}`, datos);
        await onGuardado(`Tipo "${datos.room_type_name}" actualizado.`);
      } else {
        await api.post("/tipos-habitacion", datos);
        await onGuardado(`Tipo "${datos.room_type_name}" creado.`);
      }
    } catch (err) {
      setErrorServidor(err instanceof Error ? err.message : "No se pudo guardar el tipo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={guardar} noValidate className="flex flex-col gap-5">
      <InfoBox tipo="regla">
        Un tipo inactivo no se ofrece al registrar habitaciones nuevas, pero las que ya lo
        tienen asignado siguen existiendo.
      </InfoBox>

      <Field label="Nombre" htmlFor="tipo-nombre" requerido error={errores.nombre}>
        <Input
          id="tipo-nombre"
          value={nombre}
          maxLength={60}
          placeholder="Por ejemplo, Suite"
          invalido={Boolean(errores.nombre)}
          onChange={(e) => setNombre(e.target.value)}
        />
      </Field>

      <Field
        label="Capacidad máxima"
        htmlFor="tipo-capacidad"
        requerido
        error={errores.capacidad}
        ayuda="Cantidad máxima de personas que admite el tipo."
      >
        <Input
          id="tipo-capacidad"
          type="number"
          min={1}
          max={CAPACIDAD_MAX}
          inputMode="numeric"
          value={capacidad}
          invalido={Boolean(errores.capacidad)}
          onChange={(e) => setCapacidad(e.target.value)}
        />
      </Field>

      <Field label="Descripción" htmlFor="tipo-descripcion" ayuda="Opcional. Hasta 255 caracteres.">
        <textarea
          id="tipo-descripcion"
          rows={3}
          maxLength={255}
          value={descripcion}
          placeholder="Qué incluye este tipo de habitación"
          className={CLASE_TEXTAREA}
          onChange={(e) => setDescripcion(e.target.value)}
        />
      </Field>

      <Field label="Estado" htmlFor="tipo-estado">
        <Select id="tipo-estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </Select>
      </Field>

      {errorServidor && <InfoBox tipo="error">{errorServidor}</InfoBox>}

      <CardFooter>
        {tipo && (
          <Button type="button" variante="secundario" onClick={onCancelar} disabled={guardando}>
            Cancelar edición
          </Button>
        )}
        <Button type="submit" cargando={guardando}>
          Guardar tipo de habitación
        </Button>
      </CardFooter>
    </form>
  );
}
