"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Button, Card, CardFooter, Field, FieldGrid, InfoBox, Input, Select,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Articulo, Categoria } from "@/lib/types";

const UNIDADES = ["UNIDAD", "CAJA", "BIDON", "PAQUETE", "LITRO", "KILO"];

/**
 * Ficha/edición de artículo (STK-02), pensada para vivir en la ventana
 * emergente que abre el botón "Ficha" de cada fila — mismo patrón que
 * "Nuevo artículo" y "Registrar movimiento".
 */
export default function EditarArticuloPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [articulo, setArticulo] = useState<Articulo | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);

  const [numero, setNumero] = useState("");
  const [nombre, setNombre] = useState("");
  const [nombreCompuesto, setNombreCompuesto] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [unidadMedida, setUnidadMedida] = useState("UNIDAD");
  const [stockMinimo, setStockMinimo] = useState("0");
  const [descripcion, setDescripcion] = useState("");

  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [art, cats] = await Promise.all([
          api.get<Articulo>(`/articulos/${id}`),
          api.get<Categoria[]>("/categorias").catch(() => [] as Categoria[]),
        ]);
        setArticulo(art);
        setNumero(art.article_number ?? "");
        setNombre(art.article_name);
        setNombreCompuesto(art.article_compound_name ?? "");
        setCategoriaId(String(art.category_id));
        setUnidadMedida(art.article_unit_of_measure);
        setStockMinimo(String(art.article_stock_min_general));
        setDescripcion(art.article_description ?? "");

        // La categoría actual del artículo se deja igual como opción,
        // aunque esté desactivada, para no romper la ficha ya guardada.
        const activas = cats.filter((c) => c.category_state);
        const actual = cats.find((c) => c.category_id === art.category_id);
        setCategorias(actual && !actual.category_state ? [actual, ...activas] : activas);
      } catch (err) {
        setErrorCarga(err instanceof ApiError ? err.message : "No se pudo cargar el artículo.");
      } finally {
        setCargando(false);
      }
    })();
  }, [id]);

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
      await api.put(`/articulos/${id}`, {
        numero: numero.trim() || null,
        nombre: nombre.trim(),
        nombreCompuesto: nombreCompuesto.trim() || null,
        categoriaId: Number(categoriaId),
        unidadMedida,
        stockMinimo: minimo,
        descripcion: descripcion.trim() || null,
      });

      try {
        new BroadcastChannel("articulos_updates").postMessage({ type: "ARTICULO_UPDATED" });
      } catch {
        /* no crítico */
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

  if (cargando) {
    return (
      <div className="p-6">
        <p className="py-10 text-center text-sm text-carbon/50">Cargando…</p>
      </div>
    );
  }

  if (errorCarga || !articulo) {
    return (
      <div className="p-6">
        <InfoBox tipo="error">{errorCarga ?? "El artículo no existe."}</InfoBox>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        titulo={`Ficha de ${articulo.article_name}`}
        descripcion="Los cambios impactan en el catálogo y en las pantallas de stock."
      />

      <Card>
        <form onSubmit={guardar} className="space-y-6">
          <FieldGrid>
            <Field label="Código" htmlFor="codigo">
              <Input id="codigo" value={articulo.article_code} className="font-mono" disabled readOnly />
            </Field>

            <Field label="Nombre" htmlFor="nombre" requerido>
              <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </Field>

            <Field label="Nombre compuesto" htmlFor="compuesto" ayuda="Nombre largo que se usa en remitos.">
              <Input id="compuesto" value={nombreCompuesto} onChange={(e) => setNombreCompuesto(e.target.value)} />
            </Field>

            <Field label="Categoría" htmlFor="categoria" requerido>
              <Select id="categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
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
          {exito && <InfoBox tipo="exito">Cambios guardados. Cerrando ventana…</InfoBox>}

          <CardFooter>
            <Button type="button" variante="secundario" onClick={() => window.close()}>
              Cancelar
            </Button>
            <Button type="submit" cargando={guardando} disabled={exito}>
              Guardar cambios
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}