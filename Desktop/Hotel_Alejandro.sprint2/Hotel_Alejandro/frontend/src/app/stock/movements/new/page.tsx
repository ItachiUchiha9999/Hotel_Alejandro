"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Button, Card, CardFooter, EmptyState, Field, FieldGrid,
  InfoBox, Input, Select, Table, THead, TH, TBody, TR, TD,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Articulo, Deposito, RenglonMovimiento, TipoMovimiento } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * Registrar un movimiento de stock (STK-05).
 *
 * Un movimiento puede llevar varios artículos: se cargan en un renglón y todos
 * viajan bajo una misma cabecera. Si falla cualquiera, el backend revierte el
 * movimiento completo.
 *
 * Qué depósitos se piden lo decide el `effect` del tipo elegido, que es la
 * misma regla que aplica el backend.
 */
export default function NuevoMovimientoPage() {
  const router = useRouter();

  const [tipos, setTipos] = useState<TipoMovimiento[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [tipoId, setTipoId] = useState<number | null>(null);

  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [codigoRenglon, setCodigoRenglon] = useState("");
  const [cantidadRenglon, setCantidadRenglon] = useState("1");
  const [renglones, setRenglones] = useState<RenglonMovimiento[]>([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  /**
   * Sin datos por defecto inventados: si la API no responde, el formulario
   * queda bloqueado en lugar de dejar cargar contra depósitos que no existen.
   */
  const cargarCatalogos = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);

    try {
      const [tiposApi, depositosApi, articulosApi] = await Promise.all([
        api.get<TipoMovimiento[]>("/stock/tipos-movimiento"),
        api.get<Deposito[]>("/depositos?activos=true"),
        api.get<Articulo[]>("/articulos?activos=true"),
      ]);

      if (tiposApi.length === 0) {
        throw new ApiError("No hay tipos de movimiento activos configurados.", 0);
      }
      if (depositosApi.length === 0) {
        throw new ApiError("No hay depósitos activos. Cargá al menos uno antes de continuar.", 0);
      }

      const tiposDisponibles = tiposApi.filter(
  (t) => t.effect !== "TRANSFERENCIA"
);

if (tiposDisponibles.length === 0) {
  throw new ApiError(
    "No hay tipos de movimiento disponibles para registrar.",
    0
  );
}

      setTipos(tiposDisponibles);
      setDepositos(depositosApi);
      setArticulos(articulosApi);

      setTipoId(tiposDisponibles[0].movement_type_id);

      setOrigen(String(depositosApi[0].deposit_id));
      setDestino(
        String(depositosApi[1]?.deposit_id ?? depositosApi[0].deposit_id)
      );
    } catch (err) {
      setErrorCarga(err instanceof ApiError ? err.message : "No se pudo preparar el formulario.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  const tipo = useMemo(
    () => tipos.find((t) => t.movement_type_id === tipoId) ?? null,
    [tipos, tipoId],
  );

  const pideOrigen = tipo?.effect === "RESTA" || tipo?.effect === "TRANSFERENCIA";
  const pideDestino = tipo?.effect === "SUMA" || tipo?.effect === "TRANSFERENCIA";
  const bloqueado = cargando || Boolean(errorCarga) || !tipo;

  function agregarRenglon() {
    setErrorForm(null);

    const codigo = codigoRenglon.trim().toUpperCase();
    const cantidad = Number(cantidadRenglon);

    if (!codigo) return setErrorForm("Elegí un artículo para agregar.");
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      return setErrorForm("La cantidad tiene que ser un número entero mayor a cero.");
    }

    const articulo = articulos.find((a) => a.article_code.toUpperCase() === codigo);
    if (!articulo) return setErrorForm(`No existe ningún artículo con el código ${codigo}.`);

    setRenglones((previos) => {
      const existente = previos.find((r) => r.article_code === articulo.article_code);
      if (existente) {
        return previos.map((r) =>
          r.article_code === articulo.article_code ? { ...r, amount: r.amount + cantidad } : r,
        );
      }
      return [
        ...previos,
        { article_code: articulo.article_code, article_name: articulo.article_name, amount: cantidad },
      ];
    });

    setCodigoRenglon("");
    setCantidadRenglon("1");
  }

  const quitarRenglon = (codigo: string) =>
    setRenglones((previos) => previos.filter((r) => r.article_code !== codigo));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErrorForm(null);
    setExito(null);

    if (!tipo) return;
    if (renglones.length === 0) return setErrorForm("Agregá al menos un artículo al movimiento.");
    if (pideOrigen && !origen) return setErrorForm("Elegí el depósito de origen.");
    if (pideDestino && !destino) return setErrorForm("Elegí el depósito de destino.");
    if (tipo.effect === "TRANSFERENCIA" && origen === destino) {
      return setErrorForm("El depósito de origen y el de destino deben ser distintos.");
    }

    setGuardando(true);
    try {
      await api.post("/stock/movimientos", {
        movement_type_id: tipo.movement_type_id,
        details: renglones.map((r) => ({ article_code: r.article_code, amount: r.amount })),
        deposit_origin_id: pideOrigen ? Number(origen) : null,
        deposit_destination_id: pideDestino ? Number(destino) : null,
        observations: observaciones.trim() || null,
      });

      const cantidadArticulos = renglones.length;
      setExito(
        `${tipo.movement_type.replaceAll("_", " ")} registrado con ` +
          `${cantidadArticulos} artículo${cantidadArticulos > 1 ? "s" : ""}.`,
      );
      setRenglones([]);
      setObservaciones("");
      router.refresh();
    } catch (err) {
      setErrorForm(err instanceof ApiError ? err.message : "No se pudo registrar el movimiento.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow=""
        titulo="Registrar movimiento de stock"
        descripcion=""
      />

      {errorCarga && (
        <div className="mb-6">
          <InfoBox tipo="error" titulo="No se pudo preparar el formulario:">
            {errorCarga}{" "}
            <button type="button" onClick={cargarCatalogos} className="underline underline-offset-2">
              Reintentar
            </button>
          </InfoBox>
        </div>
      )}

      <form onSubmit={guardar} className="space-y-6">
        <Card titulo="Datos del movimiento">
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-carbon/70">
                Tipo de movimiento
              </p>

              {cargando ? (
                <div className="h-10 animate-pulse rounded-md bg-bone" />
              ) : (
                <Select
                  id="tipo-movimiento"
                  value={tipoId ?? ""}
                  onChange={(e) => {
                    setTipoId(Number(e.target.value));
                    setErrorForm(null);
                  }}
                  disabled={bloqueado}
                >
                  {tipos.map((t) => (
                    <option
                      key={t.movement_type_id}
                      value={t.movement_type_id}
                    >
                      {t.movement_type.replaceAll("_", " ")}
                    </option>
                  ))}
                </Select>
              )}

              {tipo && <p className="mt-2 text-xs text-carbon/50">{tipo.description}</p>}
            </div>

            <FieldGrid>
              {pideOrigen && (
                <Field label="Depósito de origen" htmlFor="origen" requerido>
                  <Select
                    id="origen"
                    value={origen}
                    onChange={(e) => setOrigen(e.target.value)}
                    disabled={bloqueado}
                  >
                    {depositos.map((d) => (
                      <option key={d.deposit_id} value={d.deposit_id}>
                        {d.deposit_name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              {pideDestino && (
                <Field label="Depósito de destino" htmlFor="destino" requerido>
                  <Select
                    id="destino"
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                    disabled={bloqueado}
                  >
                    {depositos.map((d) => (
                      <option key={d.deposit_id} value={d.deposit_id}>
                        {d.deposit_name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              <Field label="Observación o remito" htmlFor="obs" className="md:col-span-2">
                <Input
                  id="obs"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  disabled={bloqueado}
                  placeholder="Número de comprobante o nota sobre el movimiento"
                />
              </Field>
            </FieldGrid>
          </div>
        </Card>

        <Card
          titulo="Artículos"
          descripcion="Agregá uno o varios. Si repetís un artículo, las cantidades se suman."
        >
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <Field label="Artículo" htmlFor="articulo">
                <Input
                  id="articulo"
                  list="lista-articulos"
                  value={codigoRenglon}
                  onChange={(e) => setCodigoRenglon(e.target.value)}
                  disabled={bloqueado}
                  placeholder="Buscar por código"
                  className="font-mono"
                />
              </Field>
              <datalist id="lista-articulos">
                {articulos.map((a) => (
                  <option key={a.article_id} value={a.article_code}>
                    {a.article_name}
                  </option>
                ))}
              </datalist>
            </div>

            <div className="w-32">
              <Field label="Cantidad" htmlFor="cantidad">
                <Input
                  id="cantidad"
                  type="number"
                  min="1"
                  step="1"
                  value={cantidadRenglon}
                  onChange={(e) => setCantidadRenglon(e.target.value)}
                  disabled={bloqueado}
                />
              </Field>
            </div>

            <Button type="button" variante="secundario" onClick={agregarRenglon} disabled={bloqueado}>
              Agregar
            </Button>
          </div>

          {renglones.length === 0 ? (
            <EmptyState
              titulo="Todavía no agregaste artículos"
              descripcion="Elegí un artículo y una cantidad, y tocá Agregar."
            />
          ) : (
            <Table>
              <THead>
                <TH>Código</TH>
                <TH>Artículo</TH>
                <TH className="text-right">Cantidad</TH>
                <TH className="text-right">Acciones</TH>
              </THead>
              <TBody>
                {renglones.map((r) => (
                  <TR key={r.article_code}>
                    <TD className="font-mono text-xs">{r.article_code}</TD>
                    <TD className="font-medium">{r.article_name}</TD>
                    <TD className="text-right tabular-nums">
                      {r.amount.toLocaleString("es-AR")}
                    </TD>
                    <TD className="text-right">
                      <Button
                        tamano="sm"
                        variante="peligro"
                        onClick={() => quitarRenglon(r.article_code)}
                      >
                        Quitar
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}

          <div className="mt-6 space-y-4">
            {errorForm && <InfoBox tipo="error">{errorForm}</InfoBox>}

            <CardFooter>
              <Button type="button" variante="secundario" onClick={() => router.push("/stock")}>
                Volver al stock
              </Button>
              <Button
                type="submit"
                cargando={guardando}
                disabled={bloqueado || renglones.length === 0}
              >
                Guardar movimiento
              </Button>
            </CardFooter>
          </div>
        </Card>
      </form>
      {exito && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
    <div className="w-[340px] rounded-xl border border-line bg-white p-6 shadow-xl">
      <div className="text-center">

        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-green-50 text-xl font-bold text-green-700">
          ✓
        </div>

        <h2 className="text-lg font-semibold text-carbon">
          Movimiento registrado
        </h2>

        <p className="mt-2 text-sm text-carbon/60">
          {exito}
        </p>

        <Button
          type="button"
          className="mt-5"
          onClick={() => setExito(null)}
        >
          Aceptar
        </Button>

      </div>
    </div>
  </div>
)}
    </>
  );
}