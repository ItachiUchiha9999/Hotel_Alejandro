"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Badge, Button, Card, CardFooter, EmptyState, Field, FieldGrid,
  InfoBox, Input, Select, Table, THead, TH, TBody, TR, TD,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Efecto, TipoMovimiento } from "@/lib/types";

const EFECTOS: { valor: Efecto; etiqueta: string; explica: string }[] = [
  { valor: "SUMA", etiqueta: "Suma", explica: "Ingresa mercadería a un depósito." },
  { valor: "RESTA", etiqueta: "Resta", explica: "Descuenta mercadería de un depósito." },
  { valor: "TRANSFERENCIA", etiqueta: "Transferencia", explica: "Mueve entre dos depósitos." },
];

const tonoPorEfecto: Record<Efecto, "activo" | "alerta" | "info"> = {
  SUMA: "activo",
  RESTA: "alerta",
  TRANSFERENCIA: "info",
};

/**
 * ABM de tipos de movimiento (STK-04).
 *
 * El `effect` de cada tipo es lo que el motor de stock usa para decidir si un
 * movimiento suma, resta o transfiere. Por eso un tipo nuevo funciona de
 * inmediato en la pantalla de registro, sin tocar código.
 */
export default function TiposMovimientoPage() {
  const [tipos, setTipos] = useState<TipoMovimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [modoAlta, setModoAlta] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [efecto, setEfecto] = useState<Efecto>("SUMA");
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      setTipos(await api.get<TipoMovimiento[]>("/tipos-movimiento"));
    } catch (err) {
      setErrorCarga(err instanceof ApiError ? err.message : "No se pudieron cargar los tipos.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirAlta() {
    setModoAlta(true);
    setEditandoId(null);
    setNombre("");
    setDescripcion("");
    setEfecto("SUMA");
    setErrorForm(null);
  }

  function abrirEdicion(tipo: TipoMovimiento) {
    setModoAlta(false);
    setEditandoId(tipo.movement_type_id);
    setNombre(tipo.movement_type);
    setDescripcion(tipo.description);
    setEfecto(tipo.effect);
    setErrorForm(null);
  }

  function cerrarPanel() {
    setModoAlta(false);
    setEditandoId(null);
    setErrorForm(null);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErrorForm(null);
    setAviso(null);

    if (modoAlta && !nombre.trim()) return setErrorForm("El nombre del tipo es obligatorio.");
    if (!descripcion.trim()) return setErrorForm("La descripción es obligatoria.");

    setGuardando(true);
    try {
      if (modoAlta) {
        await api.post("/tipos-movimiento", {
          movement_type: nombre.trim(),
          description: descripcion.trim(),
          effect: efecto,
        });
        setAviso("Tipo de movimiento creado.");
      } else if (editandoId) {
        await api.put(`/tipos-movimiento/${editandoId}`, {
          description: descripcion.trim(),
          effect: efecto,
        });
        setAviso("Tipo de movimiento actualizado.");
      }

      cerrarPanel();
      await cargar();
    } catch (err) {
      setErrorForm(err instanceof ApiError ? err.message : "No se pudo guardar el tipo.");
    } finally {
      setGuardando(false);
    }
  }

  async function alternarEstado(tipo: TipoMovimiento) {
    setAviso(null);
    try {
      await api.patch(`/tipos-movimiento/${tipo.movement_type_id}/estado`, {
        active: !tipo.active,
      });
      await cargar();
    } catch (err) {
      setErrorCarga(err instanceof ApiError ? err.message : "No se pudo cambiar el estado.");
    }
  }

  const panelAbierto = modoAlta || editandoId !== null;

  return (
    <>
      <PageHeader
        eyebrow=""
        titulo="Tipos de movimiento"
        descripcion=""
        acciones={<Button onClick={abrirAlta}>Nuevo tipo</Button>}
      />

      <Card>
        {errorCarga && (
          <InfoBox tipo="error">
            {errorCarga}{" "}
            <button type="button" onClick={cargar} className="underline underline-offset-2">
              Reintentar
            </button>
          </InfoBox>
        )}
        {aviso && <InfoBox tipo="exito">{aviso}</InfoBox>}

        {cargando ? (
          <p className="py-10 text-center text-sm text-carbon/50">Cargando tipos…</p>
        ) : tipos.length === 0 ? (
          <EmptyState
            titulo="No hay tipos de movimiento"
            descripcion="Sin tipos cargados no se pueden registrar movimientos de stock."
            accion={<Button onClick={abrirAlta}>Crear el primero</Button>}
          />
        ) : (
          <Table>
            <THead>
              <TH>Tipo</TH>
              <TH>Descripción</TH>
              <TH>Efecto</TH>
              <TH>Estado</TH>
              <TH className="text-right">Acciones</TH>
            </THead>
            <TBody>
              {tipos.map((t) => (
                <TR key={t.movement_type_id}>
                  <TD className="font-medium">{t.movement_type.replaceAll("_", " ")}</TD>
                  <TD className="text-xs text-carbon/70">{t.description}</TD>
                  <TD>
                    <Badge tono={tonoPorEfecto[t.effect]}>{t.effect}</Badge>
                  </TD>
                  <TD>
                    <Badge tono={t.active ? "activo" : "inactivo"}>
                      {t.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button tamano="sm" variante="secundario" onClick={() => abrirEdicion(t)}>
                        Editar
                      </Button>
                      <Button
                        tamano="sm"
                        variante={t.active ? "peligro" : "secundario"}
                        onClick={() => alternarEstado(t)}
                      >
                        {t.active ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {panelAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
          <div className="w-full max-w-2xl">
            <Card
              titulo={modoAlta ? "Nuevo tipo de movimiento" : "Editar tipo de movimiento"}
              descripcion="El efecto determina cómo impacta este tipo en el stock."
            >
              <form onSubmit={guardar} className="space-y-6">
                <FieldGrid>
                  <Field
                    label="Nombre"
                    htmlFor="nombre"
                    requerido={modoAlta}
                    ayuda={
                      modoAlta
                        ? "Se guarda en mayúsculas. Por ejemplo: DEVOLUCION_PROVEEDOR."
                        : "El nombre no se puede cambiar una vez creado."
                    }
                  >
                    <Input
                      id="nombre"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      disabled={!modoAlta}
                      placeholder="DEVOLUCION_PROVEEDOR"
                    />
                  </Field>

                  <Field
                    label="Efecto sobre el stock"
                    htmlFor="efecto"
                    requerido
                  >
                    <Select
                      id="efecto"
                      value={efecto}
                      onChange={(e) => setEfecto(e.target.value as Efecto)}
                    >
                      {EFECTOS.map((op) => (
                        <option key={op.valor} value={op.valor}>
                          {op.etiqueta} — {op.explica}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field
                    label="Descripción"
                    htmlFor="descripcion"
                    requerido
                    className="md:col-span-2"
                  >
                    <Input
                      id="descripcion"
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      placeholder="Devolución de mercadería en mal estado al proveedor"
                    />
                  </Field>
                </FieldGrid>

                <InfoBox tipo="regla" titulo="Regla del sistema:">
                  el efecto de un tipo no se puede cambiar si ya tiene movimientos
                  registrados. Cambiarlo reinterpretaría el histórico y dejaría los
                  saldos sin explicación en la auditoría. En ese caso, creá un tipo
                  nuevo y desactivá el anterior.
                </InfoBox>

                {errorForm && (
                  <InfoBox tipo="error">{errorForm}</InfoBox>
                )}

                <CardFooter>
                  <Button
                    type="button"
                    variante="secundario"
                    onClick={cerrarPanel}
                  >
                    Cancelar
                  </Button>

                  <Button type="submit" cargando={guardando}>
                    {modoAlta ? "Crear tipo" : "Guardar cambios"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
