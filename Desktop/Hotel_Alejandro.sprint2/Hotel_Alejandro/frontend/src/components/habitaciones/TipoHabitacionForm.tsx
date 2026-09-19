"use client";

import { useState } from "react";
import { Button, CardFooter, Field, InfoBox, Input, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { TipoHabitacion } from "@/lib/types";

interface Props {
  /** Si viene, el formulario edita ese tipo; si es null, da de alta uno nuevo. */
  tipo: TipoHabitacion | null;
  onGuardado: (mensaje: string) => void;
  onCancelar: () => void;
}

/**
 * Formulario de tipos de habitación (HAB-03).
 * Vive en la columna angosta del layout ABM, por eso los campos van apilados.
 * La página lo monta con `key` para que al cambiar de tipo arranque limpio.
 */
export function TipoHabitacionForm({ tipo, onGuardado, onCancelar }: Props) {
  const esEdicion = tipo !== null;

  const [nombre, setNombre] = useState(tipo?.room_type_name ?? "");
  const [descripcion, setDescripcion] = useState(tipo?.room_type_description ?? "");
  const [capacidad, setCapacidad] = useState(tipo ? String(tipo.room_type_max_capacity) : "");
  const [activo, setActivo] = useState(tipo?.room_type_state ?? true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const capacidadNum = Number(capacidad);
  const capacidadInvalida = capacidad !== "" && (!Number.isInteger(capacidadNum) || capacidadNum <= 0);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombre.trim()) return setError("Ingresá el nombre del tipo de habitación.");
    if (capacidad === "" || capacidadInvalida) {
      return setError("La capacidad máxima debe ser un número entero mayor a cero.");
    }

    setGuardando(true);
    try {
      const cuerpo = {
        room_type_name: nombre.trim(),
        room_type_description: descripcion.trim() || null,
        room_type_max_capacity: capacidadNum,
        room_type_state: activo,
      };

      if (esEdicion) {
        await api.put(`/tipos-habitacion/${tipo.room_type_id}`, cuerpo);
      } else {
        await api.post("/tipos-habitacion", cuerpo);
      }

      if (!esEdicion) {
        setNombre("");
        setDescripcion("");
        setCapacidad("");
        setActivo(true);
      }
      onGuardado(esEdicion ? "Tipo de habitación actualizado." : "Tipo de habitación creado.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el tipo de habitación.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-5" noValidate>
      <Field label="Nombre" htmlFor="tipo-nombre" requerido>
        <Input
          id="tipo-nombre"
          value={nombre}
          maxLength={50}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Doble"
          invalido={Boolean(error) && !nombre.trim()}
        />
      </Field>

      <Field label="Descripción" htmlFor="tipo-descripcion" ayuda="Camas, tamaño o comodidades que lo distinguen.">
        <Input
          id="tipo-descripcion"
          value={descripcion}
          maxLength={255}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Cama matrimonial o dos camas individuales"
        />
      </Field>

      <Field
        label="Capacidad máxima"
        htmlFor="tipo-capacidad"
        requerido
        error={capacidadInvalida ? "Tiene que ser un entero mayor a cero." : undefined}
      >
        <Input
          id="tipo-capacidad"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={capacidad}
          onChange={(e) => setCapacidad(e.target.value)}
          placeholder="2"
          invalido={capacidadInvalida}
        />
      </Field>

      <Field label="Estado" htmlFor="tipo-estado">
        <Select
          id="tipo-estado"
          value={activo ? "activo" : "inactivo"}
          onChange={(e) => setActivo(e.target.value === "activo")}
        >
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </Select>
      </Field>

      <InfoBox tipo="regla" titulo="Regla del sistema:">
        un tipo inactivo no se ofrece al registrar habitaciones nuevas, y no se puede eliminar un
        tipo que ya tenga habitaciones asociadas.
      </InfoBox>

      {error && <InfoBox tipo="error">{error}</InfoBox>}

      <CardFooter>
        {esEdicion && (
          <Button type="button" variante="secundario" onClick={onCancelar}>
            Cancelar
          </Button>
        )}
        <Button type="submit" cargando={guardando}>
          {esEdicion ? "Guardar cambios" : "Crear tipo"}
        </Button>
      </CardFooter>
    </form>
  );
}
