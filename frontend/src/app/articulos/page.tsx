"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Badge, Button, Card, EmptyState, InfoBox, Input, Select,
  Table, THead, TH, TBody, TR, TD,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Articulo, Categoria } from "@/lib/types";

type FiltroEstado = "todos" | "activos" | "inactivos";

/**
 * Catálogo de artículos (STK-02).
 *
 * "Nuevo artículo" y "Ficha" ya no abren un panel inline: abren una ventana
 * emergente (window.open), mismo patrón que "Registrar movimiento" en
 * /stock. Cuando esa ventana termina de guardar, avisa acá por
 * BroadcastChannel (y por postMessage, como respaldo) para refrescar la
 * tabla sin que haga falta recargar la página a mano.
 */
export default function CatalogoArticulosPage() {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");

  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const [arts, cats] = await Promise.all([
        api.get<Articulo[]>("/articulos"),
        api.get<Categoria[]>("/categorias").catch(() => [] as Categoria[]),
      ]);
      setArticulos(arts);
      setCategorias(cats);
    } catch (err) {
      setErrorCarga(
        err instanceof ApiError ? err.message : "No se pudo cargar el catálogo.",
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Escucha la ventana emergente de alta/edición de artículos.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "ARTICULO_UPDATED") cargar();
    };
    window.addEventListener("message", handleMessage);

    let channel: BroadcastChannel | undefined;
    try {
      channel = new BroadcastChannel("articulos_updates");
      channel.onmessage = () => cargar();
    } catch {
      /* BroadcastChannel no disponible en este navegador: queda solo postMessage */
    }

    return () => {
      window.removeEventListener("message", handleMessage);
      channel?.close();
    };
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

  /** Abre una ventana emergente centrada, mismo tamaño que "Registrar movimiento". */
  function abrirVentana(ruta: string) {
    const width = 960;
    const height = 750;
    const left = Math.max(0, Math.round((window.screen.width - width) / 2));
    const top = Math.max(0, Math.round((window.screen.height - height) / 2));

    window.open(
      ruta,
      "_blank",
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`,
    );
  }

  const abrirAlta = () => abrirVentana("/articulos/nuevo");
  const abrirFicha = (articulo: Articulo) => abrirVentana(`/articulos/${articulo.article_id}`);

  async function alternarEstado(articulo: Articulo) {
    try {
      await api.patch(`/articulos/${articulo.article_id}/estado`, {
        estado: !articulo.article_state,
      });
      await cargar();
    } catch (err) {
      setErrorAccion(err instanceof ApiError ? err.message : "No se pudo cambiar el estado.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow=""
        titulo="Catálogo de artículos"
        descripcion=""
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
        {errorAccion && <InfoBox tipo="error">{errorAccion}</InfoBox>}

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
    </>
  );
}