"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Badge, Button, Card, EmptyState, InfoBox, Input, Select,
  Table, THead, TH, TBody, TR, TD,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";

type FiltroEstado = "todos" | "activos" | "inactivos";

interface Proveedor {
  supplier_id: number;
  supplier_legal_name: string;
  supplier_trade_name: string | null;
  supplier_cuit: string;
  supplier_email: string | null;
  supplier_phone: string | null;
  supplier_address: string | null;
  supplier_state: boolean;
  tax_condition_name?: string | null;
}

export default function CatalogoProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const res = await api.get<any>("/proveedores");
      const lista = Array.isArray(res) ? res : res?.data;
      setProveedores(lista ?? []);
    } catch (err) {
      setErrorCarga(
        err instanceof ApiError ? err.message : "No se pudo cargar el listado de proveedores."
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Escucha la ventana emergente de alta/edición de proveedores
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "PROVEEDOR_UPDATED") cargar();
    };
    window.addEventListener("message", handleMessage);

    let channel: BroadcastChannel | undefined;
    try {
      channel = new BroadcastChannel("proveedores_updates");
      channel.onmessage = () => cargar();
    } catch {
      /* BroadcastChannel no disponible */
    }

    return () => {
      window.removeEventListener("message", handleMessage);
      channel?.close();
    };
  }, [cargar]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return proveedores.filter((p) => {
      const texto = `${p.supplier_cuit} ${p.supplier_legal_name} ${p.supplier_trade_name ?? ""}`.toLowerCase();
      const coincideTexto = !q || texto.includes(q);
      const coincideEstado =
        filtroEstado === "todos" ||
        (filtroEstado === "activos" ? p.supplier_state : !p.supplier_state);
      return coincideTexto && coincideEstado;
    });
  }, [proveedores, busqueda, filtroEstado]);

  function abrirVentana(ruta: string) {
    const width = 960;
    const height = 750;
    const left = Math.max(0, Math.round((window.screen.width - width) / 2));
    const top = Math.max(0, Math.round((window.screen.height - height) / 2));

    window.open(
      ruta,
      "_blank",
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
    );
  }

  const abrirAlta = () => abrirVentana("/proveedores/nuevo");
  const abrirFicha = (p: Proveedor) => abrirVentana(`/proveedores/${p.supplier_id}`);

  async function alternarEstado(p: Proveedor) {
    try {
      await api.patch(`/proveedores/${p.supplier_id}/estado`, {
        estado: !p.supplier_state,
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
        titulo="Catálogo de proveedores"
        descripcion=""
        acciones={<Button onClick={abrirAlta}>Nuevo proveedor</Button>}
      />

      <Card>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Input
            type="search"
            placeholder="Buscar por CUIT, razón social o fantasía"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="max-w-xs"
          />

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
            {proveedores.length} proveedores · {visibles.length} visibles
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
          <p className="py-10 text-center text-sm text-carbon/50">Cargando proveedores…</p>
        ) : visibles.length === 0 ? (
          <EmptyState
            titulo="No hay proveedores para mostrar"
            descripcion={
              proveedores.length === 0
                ? "Todavía no cargaste ningún proveedor al catálogo."
                : "Ningún proveedor coincide con los filtros."
            }
            accion={
              proveedores.length === 0 ? (
                <Button onClick={abrirAlta}>Crear el primero</Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <THead>
              <TH>CUIT</TH>
              <TH>Razón social / Fantasía</TH>
              <TH>Condición Fiscal</TH>
              <TH>Contacto</TH>
              <TH>Estado</TH>
              <TH className="text-right">Acciones</TH>
            </THead>
            <TBody>
              {visibles.map((p) => (
                <TR key={p.supplier_id}>
                  <TD className="font-mono text-xs">{p.supplier_cuit}</TD>
                  <TD className="font-medium">
                    {p.supplier_legal_name}
                    {p.supplier_trade_name && (
                      <span className="block text-xs font-normal text-carbon/45">
                        {p.supplier_trade_name}
                      </span>
                    )}
                  </TD>
                  <TD className="text-xs">{p.tax_condition_name ?? "—"}</TD>
                  <TD className="text-xs">
                    {p.supplier_phone && <div>{p.supplier_phone}</div>}
                    {p.supplier_email && <div className="text-carbon/50">{p.supplier_email}</div>}
                    {!p.supplier_phone && !p.supplier_email && "—"}
                  </TD>
                  <TD>
                    <Badge tono={p.supplier_state ? "activo" : "inactivo"}>
                      {p.supplier_state ? "Activo" : "Inactivo"}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button tamano="sm" variante="secundario" onClick={() => abrirFicha(p)}>
                        Ficha
                      </Button>
                      <Button
                        tamano="sm"
                        variante={p.supplier_state ? "peligro" : "secundario"}
                        onClick={() => alternarEstado(p)}
                      >
                        {p.supplier_state ? "Dar de baja" : "Reactivar"}
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