"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, InfoBox } from "@/components/ui";
import { CategoriaForm } from "@/components/categorias/CategoriaForm";
import { api, ApiError } from "@/lib/api";
import type { Categoria } from "@/lib/types";

export default function EditarCategoriaPage() {
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const [categoria, setCategoria] = useState<Categoria | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        (async () => {
            try {
                setCategoria(await api.get<Categoria>(`/categorias/${id}`));
            } catch (err) {
                setError(err instanceof ApiError ? err.message : "No se pudo cargar la categoría.");
            } finally {
                setCargando(false);
            }
        })();
    }, [id]);

    return (
        <>
            <PageHeader
                eyebrow=""
                titulo="Editar categoría"
                descripcion=""
            />

            <Card>
                {cargando ? (
                    <p className="py-10 text-center text-sm text-carbon/50">Cargando…</p>
                ) : error ? (
                    <InfoBox tipo="error">{error}</InfoBox>
                ) : categoria ? (
                    <CategoriaForm categoria={categoria} />
                ) : null}
            </Card>
        </>
    );
}