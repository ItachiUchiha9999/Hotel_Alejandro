"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Button, Card, EmptyState, Input, InfoBox, Table, THead, TH, TBody, TR, TD } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Categoria } from "@/lib/types";

type Filtro = "todos" | "activos" | "inactivos";

export default function CategoriasPage() {
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busqueda, setBusqueda] = useState("");
    const [filtro, setFiltro] = useState<Filtro>("todos");

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            setCategorias(await api.get<Categoria[]>("/categorias"));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "No se pudieron cargar las categorías.");
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const visibles = useMemo(
        () =>
            categorias.filter((c) => {
                const texto = `${c.category_name} ${c.category_description ?? ""}`.toLowerCase();
                const coincide = texto.includes(busqueda.trim().toLowerCase());
                if (filtro === "activos") return coincide && c.category_state;
                if (filtro === "inactivos") return coincide && !c.category_state;
                return coincide;
            }),
        [categorias, busqueda, filtro],
    );

    async function alternarEstado(categoria: Categoria) {
        try {
            await api.patch(`/categorias/${categoria.category_id}/estado`, {
                estado: !categoria.category_state,
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
                titulo="Categorías"
                descripcion=""
                acciones={
                    <Link href="/categorias/nuevo">
                        <Button>Nueva categoría</Button>
                    </Link>
                }
            />

            <Card>
                <div className="mb-5 flex flex-wrap items-center gap-3">
                    <Input
                        type="search"
                        placeholder="Buscar por nombre o descripción"
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
                    <p className="py-10 text-center text-sm text-carbon/50">Cargando categorías…</p>
                ) : visibles.length === 0 ? (
                    <EmptyState
                        titulo="No hay categorías para mostrar"
                        descripcion={
                            categorias.length === 0
                                ? "Todavía no cargaste ninguna categoría. Sin categorías no se pueden crear artículos."
                                : "Ninguna categoría coincide con la búsqueda."
                        }
                        accion={
                            categorias.length === 0 ? (
                                <Link href="/categorias/nuevo">
                                    <Button>Crear la primera</Button>
                                </Link>
                            ) : undefined
                        }
                    />
                ) : (
                    <Table>
                        <THead>
                            <TH>Nombre</TH>
                            <TH>Descripción</TH>
                            <TH>Estado</TH>
                            <TH className="text-right">Acciones</TH>
                        </THead>
                        <TBody>
                            {visibles.map((c) => (
                                <TR key={c.category_id}>
                                    <TD className="font-medium">{c.category_name}</TD>
                                    <TD>{c.category_description ?? "—"}</TD>
                                    <TD>
                                        <Badge tono={c.category_state ? "activo" : "inactivo"}>
                                            {c.category_state ? "Activo" : "Inactivo"}
                                        </Badge>
                                    </TD>
                                    <TD className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Link href={`/categorias/${c.category_id}`}>
                                                <Button tamano="sm" variante="secundario">
                                                    Editar
                                                </Button>
                                            </Link>
                                            <Button
                                                tamano="sm"
                                                variante={c.category_state ? "peligro" : "secundario"}
                                                onClick={() => alternarEstado(c)}
                                            >
                                                {c.category_state ? "Desactivar" : "Activar"}
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