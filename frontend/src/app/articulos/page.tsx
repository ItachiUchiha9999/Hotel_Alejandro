"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Badge, Button, Card, CardFooter, EmptyState, Field, FieldGrid,
  InfoBox, Input, Select, Table, THead, TH, TBody, TR, TD,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Articulo, Categoria } from "@/lib/types";

type FiltroEstado = "todos" | "activos" | "inactivos";

interface FormArticulo {
  codigo: string;
  numero: string;
  nombre: string;
  nombreCompuesto: string;
  categoriaId: string;
  unidadMedida: string;
  stockMinimo: string;
  descripcion: string;
}

const FORM_VACIO: FormArticulo = {
  codigo: "",
  numero: "",
  nombre: "",
  nombreCompuesto: "",
  categoriaId: "",
  unidadMedida: "UNIDAD",
  stockMinimo: "0",
  descripcion: "",
};

const UNIDADES = ["UNIDAD", "CAJA", "BIDON", "PAQUETE", "LITRO", "KILO"];

/**
 * Catálogo de artículos (STK-02).
 *
 * Antes esta pantalla renderizaba su propio sidebar y su propia cabecera de
 * marca, así que el menú aparecía duplicado dentro del AppShell. Además leía la
 * respuesta del backend como un array pelado, cuando la API devuelve
 * { ok, data }: por eso fallaba con "el formato no es el esperado".
 */
export default function CatalogoArticulosPage() {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");

  const [seleccionado, setSeleccionado] = useState<Articulo | null>(null);
  const [form, setForm] = useState<FormArticulo>(FORM_VACIO);
  const [modoAlta, setModoAlta] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async (mantenerSeleccion = false) => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const [arts, cats] = await Promise.all([
        api.get<Articulo[]>("/articulos"),
        api.get<Categoria[]>("/categorias").catch(() => [] as Categoria[]),
      ]);
      setArticulos(arts);
      setCategorias(cats);

      if (mantenerSeleccion && seleccionado) {
        const actualizado = arts.find((a) => a.article_id === seleccionado.article_id);
        setSeleccionado(actualizado ?? null);
      }
    } catch (err) {
      setErrorCarga(
        err instanceof ApiError ? err.message : "No se pudo cargar el catálogo.",
      );
    } finally {
      setCargando(false);
    }
    // seleccionado se lee solo para refrescar la ficha abierta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return articulos.filter((a) => {
      const texto = `${a.article_code} ${a.article_name} ${a.article_compound_name ?? ""}`.toLowerCase();
      const coincideTexto = !q || texto.includes(q);
      const coincideCategoria =
        filtroCategoria === "todas" || String(a.category_id) === filtroCategoria;
      const coincideEstado =
        filtroEstado === "todos" ||
        (filtroEstado === "activos" ? a.article_state : !a.article_state);
      return coincideTexto && coincideCategoria && coincideEstado;
    });
  }, [articulos, busqueda, filtroCategoria, filtroEstado]);

  function abrirFicha(articulo: Articulo) {
    setModoAlta(false);
    setErrorForm(null);
    setSeleccionado(articulo);
    setForm({
      codigo: articulo.article_code,
      numero: articulo.article_number ?? "",
      nombre: articulo.article_name,
      nombreCompuesto: articulo.article_compound_name ?? "",
      categoriaId: String(articulo.category_id),
      unidadMedida: articulo.article_unit_of_measure,
      stockMinimo: String(articulo.article_stock_min_general),
      descripcion: articulo.article_description ?? "",
    });
  }

  function abrirAlta() {
    setSeleccionado(null);
    setModoAlta(true);
    setErrorForm(null);
    setForm({ ...FORM_VACIO, categoriaId: String(categorias[0]?.category_id ?? "") });
  }

  function cerrarPanel() {
    setSeleccionado(null);
    setModoAlta(false);
    setErrorForm(null);
  }

  const set = <K extends keyof FormArticulo>(campo: K, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErrorForm(null);

    if (!form.codigo.trim()) return setErrorForm("El código es obligatorio.");
    if (!form.nombre.trim()) return setErrorForm("El nombre es obligatorio.");
    if (!form.categoriaId) return setErrorForm("Elegí una categoría.");

    const minimo = Number(form.stockMinimo);
    if (!Number.isFinite(minimo) || minimo < 0) {
      return setErrorForm("El stock mínimo tiene que ser un número mayor o igual a cero.");
    }

    setGuardando(true);
    try {
      const cuerpo = {
        codigo: form.codigo.trim(),
        numero: form.numero.trim() || null,
        nombre: form.nombre.trim(),
        nombreCompuesto: form.nombreCompuesto.trim() || null,
        categoriaId: Number(form.categoriaId),
        unidadMedida: form.unidadMedida,
        stockMinimo: minimo,
        descripcion: form.descripcion.trim() || null,
      };

      if (modoAlta) {
        await api.post("/articulos", cuerpo);
      } else if (seleccionado) {
        await api.put(`/articulos/${seleccionado.article_id}`, cuerpo);
      }

      cerrarPanel();
      await cargar();
    } catch (err) {
      setErrorForm(err instanceof ApiError ? err.message : "No se pudo guardar el artículo.");
    } finally {
      setGuardando(false);
    }
  }

  async function alternarEstado(articulo: Articulo) {
    try {
      await api.patch(`/articulos/${articulo.article_id}/estado`, {
        estado: !articulo.article_state,
      });
      await cargar(true);
    } catch (err) {
      setErrorForm(err instanceof ApiError ? err.message : "No se pudo cambiar el estado.");
    }
  }

  const panelAbierto = modoAlta || Boolean(seleccionado);

  return (
    <>
      <PageHeader
        eyebrow="STK-02"
        titulo="Catálogo de artículos"
        descripcion="Insumos que el hotel compra y consume. Dar de baja un artículo lo oculta de los movimientos sin borrar su historial."
        acciones={<Button onClick={abrirAlta}>Nuevo artículo</Button>}
      />

      <Card>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Input
            type="search"
            placeholder="Buscar por código o nombre"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="max-w-xs"
          />

          <Select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="max-w-[14rem]"
            aria-label="Filtrar por categoría"
          >
            <option value="todas">Categoría: todas</option>
            {categorias.map((c) => (
              <option key={c.category_id} value={c.category_id}>
                {c.category_name}
              </option>
            ))}
          </Select>

          <Select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
            className="max-w-[11rem]"
            aria-label="Filtrar por estado"
          >
            <option value="todos">Estado: todos</option>
            <option value="activos">Solo activos</option>
            <option value="inactivos">Solo inactivos</option>
          </Select>

          <span className="ml-auto text-xs text-carbon/50">
            {articulos.length} artículos · {visibles.length} visibles
          </span>
        </div>

        {errorCarga && (
          <InfoBox tipo="error">
            {errorCarga}{" "}
            <button type="button" onClick={() => cargar()} className="underline underline-offset-2">
              Reintentar
            </button>
          </InfoBox>
        )}

        {cargando ? (
          <p className="py-10 text-center text-sm text-carbon/50">Cargando catálogo…</p>
        ) : visibles.length === 0 ? (
          <EmptyState
            titulo="No hay artículos para mostrar"
            descripcion={
              articulos.length === 0
                ? "Todavía no cargaste ningún artículo al catálogo."
                : "Ningún artículo coincide con los filtros."
            }
            accion={
              articulos.length === 0 ? <Button onClick={abrirAlta}>Crear el primero</Button> : undefined
            }
          />
        ) : (
          <Table>
            <THead>
              <TH>Código</TH>
              <TH>Artículo</TH>
              <TH>Categoría</TH>
              <TH>U.M.</TH>
              <TH className="text-right">Mín.</TH>
              <TH>Estado</TH>
              <TH className="text-right">Acciones</TH>
            </THead>
            <TBody>
              {visibles.map((a) => (
                <TR key={a.article_id}>
                  <TD className="font-mono text-xs">{a.article_code}</TD>
                  <TD className="font-medium">
                    {a.article_name}
                    {a.article_compound_name && (
                      <span className="block text-xs font-normal text-carbon/45">
                        {a.article_compound_name}
                      </span>
                    )}
                  </TD>
                  <TD className="text-xs">{a.category_name ?? "—"}</TD>
                  <TD className="text-xs">{a.article_unit_of_measure.toLowerCase()}</TD>
                  <TD className="text-right tabular-nums">
                    {Number(a.article_stock_min_general).toLocaleString("es-AR")}
                  </TD>
                  <TD>
                    <Badge tono={a.article_state ? "activo" : "inactivo"}>
                      {a.article_state ? "Activo" : "Inactivo"}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button tamano="sm" variante="secundario" onClick={() => abrirFicha(a)}>
                        Ficha
                      </Button>
                      <Button
                        tamano="sm"
                        variante={a.article_state ? "peligro" : "secundario"}
                        onClick={() => alternarEstado(a)}
                      >
                        {a.article_state ? "Dar de baja" : "Reactivar"}
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
        <div className="mt-6">
          <Card
            titulo={modoAlta ? "Nuevo artículo" : `Ficha de ${seleccionado?.article_name}`}
            descripcion={
              modoAlta
                ? "El código no se puede repetir y queda fijo como identificador del insumo."
                : "Los cambios impactan en el catálogo y en las pantallas de stock."
            }
          >
            <form onSubmit={guardar} className="space-y-6">
              <FieldGrid>
                <Field label="Código" htmlFor="codigo" requerido ayuda="Por ejemplo: BLA-001">
                  <Input
                    id="codigo"
                    value={form.codigo}
                    onChange={(e) => set("codigo", e.target.value)}
                    className="font-mono"
                    disabled={!modoAlta}
                  />
                </Field>

                <Field label="Número interno" htmlFor="numero">
                  <Input
                    id="numero"
                    value={form.numero}
                    onChange={(e) => set("numero", e.target.value)}
                  />
                </Field>

                <Field label="Nombre" htmlFor="nombre" requerido>
                  <Input
                    id="nombre"
                    value={form.nombre}
                    onChange={(e) => set("nombre", e.target.value)}
                  />
                </Field>

                <Field
                  label="Nombre compuesto"
                  htmlFor="compuesto"
                  ayuda="Nombre largo que se usa en remitos."
                >
                  <Input
                    id="compuesto"
                    value={form.nombreCompuesto}
                    onChange={(e) => set("nombreCompuesto", e.target.value)}
                  />
                </Field>

                <Field label="Categoría" htmlFor="categoria" requerido>
                  <Select
                    id="categoria"
                    value={form.categoriaId}
                    onChange={(e) => set("categoriaId", e.target.value)}
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
                  <Select
                    id="unidad"
                    value={form.unidadMedida}
                    onChange={(e) => set("unidadMedida", e.target.value)}
                  >
                    {UNIDADES.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Stock mínimo"
                  htmlFor="minimo"
                  ayuda="Por debajo de este valor, el artículo se marca en el panel."
                >
                  <Input
                    id="minimo"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.stockMinimo}
                    onChange={(e) => set("stockMinimo", e.target.value)}
                  />
                </Field>

                <Field label="Descripción" htmlFor="descripcion" className="md:col-span-2">
                  <Input
                    id="descripcion"
                    value={form.descripcion}
                    onChange={(e) => set("descripcion", e.target.value)}
                  />
                </Field>
              </FieldGrid>

              {errorForm && <InfoBox tipo="error">{errorForm}</InfoBox>}

              <CardFooter>
                <Button type="button" variante="secundario" onClick={cerrarPanel}>
                  Cancelar
                </Button>
                <Button type="submit" cargando={guardando}>
                  {modoAlta ? "Crear artículo" : "Guardar cambios"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
