"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Badge, Button, Card, CardFooter, EmptyState, Field, FieldGrid,
  InfoBox, Input, Select, Table, THead, TH, TBody, TR, TD,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { TipoComprobante } from "@/lib/types";

const SIGNOS = [
  { valor: "1", etiqueta: "Aumenta la deuda", ayuda: "Factura o nota de débito." },
  { valor: "-1", etiqueta: "Disminuye la deuda", ayuda: "Nota de crédito." },
];

export default function TiposComprobantePage() {
  const [tipos, setTipos] = useState<TipoComprobante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editando, setEditando] = useState<TipoComprobante | null>(null);
  const [alta, setAlta] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [signo, setSigno] = useState("1");
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      setTipos(await api.get<TipoComprobante[]>("/tipos-comprobante"));
    } catch (err) {
      setErrorCarga(err instanceof ApiError ? err.message : "No se pudieron cargar los tipos.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function abrirAlta() {
    setAlta(true);
    setEditando(null);
    setNombre("");
    setDescripcion("");
    setSigno("1");
    setErrorForm(null);
  }

  function abrirEdicion(tipo: TipoComprobante) {
    setAlta(false);
    setEditando(tipo);
    setNombre(tipo.voucher_type);
    setDescripcion(tipo.description);
    setSigno(String(tipo.sign));
    setErrorForm(null);
  }

  function cerrarPanel() {
    setAlta(false);
    setEditando(null);
    setErrorForm(null);
  }

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setErrorForm(null);
    if (alta && !nombre.trim()) return setErrorForm("El nombre del tipo es obligatorio.");
    if (!descripcion.trim()) return setErrorForm("La descripción es obligatoria.");

    setGuardando(true);
    try {
      if (alta) {
        await api.post("/tipos-comprobante", {
          voucher_type: nombre.trim(), description: descripcion.trim(), sign: Number(signo),
        });
        setAviso("Tipo de comprobante creado.");
      } else if (editando) {
        await api.put(`/tipos-comprobante/${editando.voucher_type_id}`, {
          description: descripcion.trim(), sign: Number(signo),
        });
        setAviso("Tipo de comprobante actualizado.");
      }
      cerrarPanel();
      await cargar();
    } catch (err) {
      setErrorForm(err instanceof ApiError ? err.message : "No se pudo guardar el tipo.");
    } finally {
      setGuardando(false);
    }
  }

  async function alternarEstado(tipo: TipoComprobante) {
    setAviso(null);
    try {
      await api.patch(`/tipos-comprobante/${tipo.voucher_type_id}/estado`, { active: !tipo.active });
      await cargar();
    } catch (err) {
      setErrorCarga(err instanceof ApiError ? err.message : "No se pudo cambiar el estado.");
    }
  }

  const panelAbierto = alta || editando !== null;

  return (
    <>
      <PageHeader
        eyebrow=""
        titulo="Tipos de comprobante"
        descripcion="Catálogo de documentos que pueden recibirse de los proveedores."
        acciones={<Button onClick={abrirAlta}>Nuevo tipo</Button>}
      />
      <Card>
        {errorCarga && <InfoBox tipo="error">{errorCarga} <button type="button" onClick={cargar} className="underline">Reintentar</button></InfoBox>}
        {aviso && <InfoBox tipo="exito">{aviso}</InfoBox>}
        {cargando ? (
          <p className="py-10 text-center text-sm text-carbon/50">Cargando tipos…</p>
        ) : tipos.length === 0 ? (
          <EmptyState titulo="No hay tipos de comprobante" descripcion="Creá el primer tipo para poder registrar comprobantes." accion={<Button onClick={abrirAlta}>Crear el primero</Button>} />
        ) : (
          <Table>
            <THead><TH>Tipo</TH><TH>Descripción</TH><TH>Efecto</TH><TH>Estado</TH><TH className="text-right">Acciones</TH></THead>
            <TBody>{tipos.map((tipo) => (
              <TR key={tipo.voucher_type_id}>
                <TD className="font-medium">{tipo.voucher_type.replaceAll("_", " ")}</TD>
                <TD className="text-xs text-carbon/70">{tipo.description}</TD>
                <TD><Badge tono={tipo.sign === 1 ? "alerta" : "info"}>{tipo.sign === 1 ? "Aumenta deuda" : "Disminuye deuda"}</Badge></TD>
                <TD><Badge tono={tipo.active ? "activo" : "inactivo"}>{tipo.active ? "Activo" : "Inactivo"}</Badge></TD>
                <TD className="text-right"><div className="flex justify-end gap-2"><Button tamano="sm" variante="secundario" onClick={() => abrirEdicion(tipo)}>Editar</Button><Button tamano="sm" variante={tipo.active ? "peligro" : "secundario"} onClick={() => alternarEstado(tipo)}>{tipo.active ? "Desactivar" : "Activar"}</Button></div></TD>
              </TR>
            ))}</TBody>
          </Table>
        )}
      </Card>

      {panelAbierto && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4"><div className="w-full max-w-2xl"><Card titulo={alta ? "Nuevo tipo de comprobante" : "Editar tipo de comprobante"}>
        <form onSubmit={guardar} className="space-y-6">
          <FieldGrid>
            <Field label="Nombre" htmlFor="nombre" requerido={alta} ayuda={alta ? "Se guarda en mayúsculas. Ejemplo: FACTURA." : "El nombre no se puede cambiar una vez creado."}><Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={!alta} /></Field>
            <Field label="Efecto sobre la deuda" htmlFor="signo" requerido><Select id="signo" value={signo} onChange={(e) => setSigno(e.target.value)}>{SIGNOS.map((opcion) => <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta} — {opcion.ayuda}</option>)}</Select></Field>
            <Field label="Descripción" htmlFor="descripcion" requerido className="md:col-span-2"><Input id="descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></Field>
          </FieldGrid>
          {errorForm && <InfoBox tipo="error">{errorForm}</InfoBox>}
          <CardFooter><Button type="button" variante="secundario" onClick={cerrarPanel}>Cancelar</Button><Button type="submit" cargando={guardando}>{alta ? "Crear tipo" : "Guardar cambios"}</Button></CardFooter>
        </form>
      </Card></div></div>}
    </>
  );
}