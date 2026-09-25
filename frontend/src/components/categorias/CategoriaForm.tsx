"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CardFooter, Field, FieldGrid, InfoBox, Input, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

interface Props {
    /** Si viene, el formulario edita esa categoría en lugar de crear una nueva. */
    categoria?: {
        category_id: number;
        category_name: string;
        category_description: string | null;
        category_state: boolean;
    };
}

export function CategoriaForm({ categoria }: Props) {
    const router = useRouter();
    const esEdicion = Boolean(categoria);

    const [nombre, setNombre] = useState(categoria?.category_name ?? "");
    const [descripcion, setDescripcion] = useState(categoria?.category_description ?? "");
    const [activo, setActivo] = useState(categoria?.category_state ?? true);
    const [error, setError] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);

    async function guardar(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!nombre.trim()) {
            setError("Ingresá el nombre de la categoría.");
            return;
        }

        setGuardando(true);
        try {
            const cuerpo = {
                category_name: nombre.trim(),
                category_description: descripcion.trim() || null,
                category_state: activo,
            };

            if (esEdicion) {
                await api.put(`/categorias/${categoria!.category_id}`, cuerpo);
            } else {
                await api.post("/categorias", cuerpo);
            }

            router.push("/categorias");
            router.refresh();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "No se pudo guardar la categoría.");
        } finally {
            setGuardando(false);
        }
    }

    return (
        <form onSubmit={guardar} className="space-y-6">
            <FieldGrid>
                <Field label="Nombre" htmlFor="nombre" requerido>
                    <Input
                        id="nombre"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        placeholder="Blancos y Mantelería"
                        invalido={Boolean(error) && !nombre.trim()}
                    />
                </Field>

                <Field label="Descripción" htmlFor="descripcion" ayuda="Opcional, para aclarar qué artículos van en esta categoría.">
                    <Input
                        id="descripcion"
                        value={descripcion}
                        onChange={(e) => setDescripcion(e.target.value)}
                        placeholder="Toallas, sábanas, fundas, manteles y servilletas"
                    />
                </Field>

                <Field label="Estado" htmlFor="estado">
                    <Select
                        id="estado"
                        value={activo ? "activo" : "inactivo"}
                        onChange={(e) => setActivo(e.target.value === "activo")}
                    >
                        <option value="activo">Activo</option>
                        <option value="inactivo">Inactivo</option>
                    </Select>
                </Field>
            </FieldGrid>

            <InfoBox tipo="regla" titulo="Regla del sistema:">
                una categoría inactiva no aparece como opción al cargar artículos nuevos. El
                nombre no se puede repetir.
            </InfoBox>

            {error && <InfoBox tipo="error">{error}</InfoBox>}

            <CardFooter>
                <Button type="button" variante="secundario" onClick={() => router.back()}>
                    Cancelar
                </Button>
                <Button type="submit" cargando={guardando}>
                    {esEdicion ? "Guardar cambios" : "Crear categoría"}
                </Button>
            </CardFooter>
        </form>
    );
}