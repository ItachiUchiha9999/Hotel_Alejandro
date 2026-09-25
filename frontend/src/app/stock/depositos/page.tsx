"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Button, Card, EmptyState, Input, InfoBox, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Deposito } from "@/lib/types";

type Filtro = "todos" | "activos" | "inactivos";

export default function DepositosPage() {
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setDepositos(await api.get<Deposito[]>("/depositos"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los depósitos.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = useMemo(
    () =>
      depositos.filter((d) => {
        const texto = `${d.deposit_name} ${d.deposit_location ?? ""}`.toLowerCase();
        const coincide = texto.includes(busqueda.trim().toLowerCase());
        if (filtro === "activos") return coincide && d.deposit_state;
        if (filtro === "inactivos") return coincide && !d.deposit_state;
        return coincide;
      }),
    [depositos, busqueda, filtro],
  );

  async function alternarEstado(deposito: Deposito) {
    try {
      await api.patch(`/depositos/${deposito.deposit_id}/estado`, {
        estado: !deposito.deposit_state,
      });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar el estado.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow=""
        titulo="Depósitos"
        descripcion=""
        acciones={
          <Link href="/stock/depositos/nuevo">
            <Button>Nuevo depósito</Button>
          </Link>
        }
      />

      <Card>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Input
            type="search"
            placeholder="Buscar por nombre o ubicación"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex gap-1">
            {(["todos", "activos", "inactivos"] as Filtro[]).map((f) => (
              <Button
                key={f}
                tamano="sm"
                variante={filtro === f ? "primario" : "secundario"}
                onClick={() => setFiltro(f)}
              >
                {f === "todos" ? "Todos" : f === "activos" ? "Activos" : "Inactivos"}
              </Button>
            ))}
          </div>
        </div>

        {error && <InfoBox tipo="error">{error}</InfoBox>}

        {cargando ? (
          <p className="py-10 text-center text-sm text-carbon/50">Cargando depósitos…</p>
        ) : visibles.length === 0 ? (
          <EmptyState
            titulo="No hay depósitos para mostrar"
            descripcion={
              depositos.length === 0
                ? "Todavía no cargaste ningún depósito. Empezá creando el depósito central."
                : "Ningún depósito coincide con la búsqueda."
            }
            accion={
              depositos.length === 0 ? (
                <Link href="/stock/depositos/nuevo">
                  <Button>Crear el primero</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <THead>
              <TH>Nombre</TH>
              <TH>Ubicación</TH>
              <TH>Estado</TH>
              <TH className="text-right">Acciones</TH>
            </THead>
            <TBody>
              {visibles.map((d) => (
                <TR key={d.deposit_id}>
                  <TD className="font-medium">{d.deposit_name}</TD>
                  <TD>{d.deposit_location ?? "—"}</TD>
                  <TD>
                    <Badge tono={d.deposit_state ? "activo" : "inactivo"}>
                      {d.deposit_state ? "Activo" : "Inactivo"}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/stock/depositos/${d.deposit_id}`}>
                        <Button tamano="sm" variante="secundario">
                          Editar
                        </Button>
                      </Link>
                      <Button
                        tamano="sm"
                        variante={d.deposit_state ? "peligro" : "secundario"}
                        onClick={() => alternarEstado(d)}
                      >
                        {d.deposit_state ? "Desactivar" : "Activar"}
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
