"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Button, Card, CardFooter, Field, FieldGrid, InfoBox, Input, Select,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Categoria } from "@/lib/types";

const UNIDADES = ["UNIDAD", "CAJA", "BIDON", "PAQUETE", "LITRO", "KILO"];

/**
 * Alta de artículo (STK-02), pensada para vivir en la ventana emergente que
 * abre el botón "Nuevo artículo" — mismo patrón que "Registrar movimiento"
 * (window.open con tamaño fijo). Al guardar, avisa a la pantalla principal
 * por BroadcastChannel para que la tabla se actualice sola, y se cierra.
 */
export default function NuevoArticuloPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargandoCategorias, setCargandoCategorias] = useState(true);

  const [codigo, setCodigo] = useState("");
  const [numero, setNumero] = useState("");
  const [nombre, setNombre] = useState("");
  const [nombreCompuesto, setNombreCompuesto] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [unidadMedida, setUnidadMedida] = useState("UNIDAD");
  const [stockMinimo, setStockMinimo] = useState("0");
  const [descripcion, setDescripcion] = useState("");

  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function pedirCodigoPreview(catId: string) {
    if (!catId) return setCodigo("");
    try {
      const { codigo: c } = await api.get<{ codigo: string }>(
        `/articulos/siguiente-codigo/${catId}`,
      );
      setCodigo(c);
    } catch {
      setCodigo("");
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const cats = await api.get<Categoria[]>("/categorias");
        const activas = cats.filter((c) => c.category_state);
        setCategorias(activas);
        const primera = String(activas[0]?.category_id ?? "");
        setCategoriaId(primera);
        if (primera) pedirCodigoPreview(primera);
      } catch {
        setErrorForm("No se pudieron cargar las categorías.");
      } finally {
        setCargandoCategorias(false);
      }
    })();
  }, []);

  function cambiarCategoria(valor: string) {
    setCategoriaId(valor);
    pedirCodigoPreview(valor);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErrorForm(null);

    if (!nombre.trim()) return setErrorForm("El nombre es obligatorio.");
    if (!categoriaId) return setErrorForm("Elegí una categoría.");

    const minimo = Number(stockMinimo);
    if (!Number.isInteger(minimo) || minimo < 0) {
      return setErrorForm("El stock mínimo tiene que ser un número entero mayor o igual a cero.");
    }

    setGuardando(true);
    try {
      await api.post("/articulos", {
        codigo: codigo.trim(),
        numero: numero.trim() || null,
        nombre: nombre.trim(),
        nombreCompuesto: nombreCompuesto.trim() || null,
        categoriaId: Number(categoriaId),
        unidadMedida,
        stockMinimo: minimo,
        descripcion: descripcion.trim() || null,
      });

      // Avisa a la pantalla principal (si sigue abierta) para que refresque
      // la tabla sola, y cierra la ventana emergente.
      try {
        new BroadcastChannel("articulos_updates").postMessage({ type: "ARTICULO_UPDATED" });
      } catch {
        /* BroadcastChannel no disponible: no es crítico, solo se pierde el auto-refresh */
      }
      window.opener?.postMessage({ type: "ARTICULO_UPDATED" }, window.location.origin);

      setExito(true);
      setTimeout(() => window.close(), 900);
    } catch (err) {
      setErrorForm(err instanceof ApiError ? err.message : "No se pudo guardar el artículo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="p-6">
      <PageHeader titulo="Nuevo artículo" descripcion="" />

      <Card>
        <form onSubmit={guardar} className="space-y-6">
          <FieldGrid>
            <Field label="Código" htmlFor="codigo" ayuda="Se genera solo, según la categoría elegida.">
              <Input id="codigo" value={codigo || "Calculando…"} className="font-mono" disabled readOnly />
            </Field>

            <Field label="Nombre" htmlFor="nombre" requerido>
              <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </Field>

            <Field label="Nombre compuesto" htmlFor="compuesto" ayuda="Nombre largo que se usa en remitos.">
              <Input id="compuesto" value={nombreCompuesto} onChange={(e) => setNombreCompuesto(e.target.value)} />
            </Field>

            <Field label="Categoría" htmlFor="categoria" requerido>
              <Select
                id="categoria"
                value={categoriaId}
                onChange={(e) => cambiarCategoria(e.target.value)}
                disabled={cargandoCategorias}
              >
                <option value="">Elegir…</option>
                {categorias.map((c) => (
                  <option key={c.category_id} value={c.category_id}>
                    {c.category_name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Unidad de medida" htmlFor="unidad">
              <Select id="unidad" value={unidadMedida} onChange={(e) => setUnidadMedida(e.target.value)}>
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </Select>
            </Field>

            <Field label="Stock mínimo" htmlFor="minimo" ayuda="Por debajo de este valor, el artículo se marca en el panel.">
              <Input
                id="minimo"
                type="number"
                min="0"
                step="1"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(e.target.value)}
              />
            </Field>

            <Field label="Descripción" htmlFor="descripcion" className="md:col-span-2">
              <Input id="descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </Field>
          </FieldGrid>

          {errorForm && <InfoBox tipo="error">{errorForm}</InfoBox>}
          {exito && <InfoBox tipo="exito">Artículo creado. Cerrando ventana…</InfoBox>}

          <CardFooter>
            <Button type="button" variante="secundario" onClick={() => window.close()}>
              Cancelar
            </Button>
            <Button type="submit" cargando={guardando} disabled={exito}>
              Crear artículo
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}