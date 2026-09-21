    "use client";

    import { useCallback, useEffect, useMemo, useState } from "react";
    import {
    BedDouble,
    Users,
    DoorOpen,
    BadgeDollarSign,
    } from "lucide-react";

    import { PageHeader } from "@/components/layout/PageHeader";
    import {
    Card,
    EmptyState,
    InfoBox,
    Select,
    } from "@/components/ui";

    import { api, ApiError } from "@/lib/api";

    interface TipoHabitacionPanel {
    room_type_id: number;
    room_type_name: string;
    description: string | null;
    max_capacity: number;
    bed_setup: string | null;
    active: boolean;

    current_price: string | number | null;
    currency: string | null;
    price_valid_from: string | null;

    active_rooms: number;
    available_rooms: number;
    total_rooms: number;
    }

    function formatearPrecio(
    precio: string | number | null,
    moneda = "ARS"
    ) {
    if (precio === null || precio === undefined) {
        return "Sin tarifa";
    }

    const numero = Number(precio);

    if (!Number.isFinite(numero)) {
        return "Sin tarifa";
    }

    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: moneda || "ARS",
        maximumFractionDigits: 0,
    }).format(numero);
    }

    function formatearFecha(fecha: string | null) {
    if (!fecha) {
        return "-";
    }

    const valor = fecha.slice(0, 10);

    const [year, month, day] = valor.split("-");

    return `${day}/${month}/${year}`;
    }

    export default function PanelHabitacionesPage() {
    const [tipos, setTipos] = useState<TipoHabitacionPanel[]>([]);

    const [cargando, setCargando] = useState(true);

    const [error, setError] = useState<string | null>(null);

    const [filtroEstado, setFiltroEstado] = useState("ACTIVOS");

    const cargar = useCallback(async () => {
        try {
        setCargando(true);
        setError(null);

        const data = await api.get<TipoHabitacionPanel[]>(
            "/panel-habitaciones"
        );

        setTipos(data);
        } catch (err) {
        setError(
            err instanceof ApiError
            ? err.message
            : "No se pudo cargar el panel de habitaciones."
        );
        } finally {
        setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const tiposVisibles = useMemo(() => {
        if (filtroEstado === "TODOS") {
        return tipos;
        }

        if (filtroEstado === "ACTIVOS") {
        return tipos.filter((tipo) => tipo.active);
        }

        return tipos.filter((tipo) => !tipo.active);
    }, [tipos, filtroEstado]);

    const resumen = useMemo(() => {
        return tipos.reduce(
        (acc, tipo) => {
            acc.total += tipo.total_rooms;
            acc.activas += tipo.active_rooms;
            acc.disponibles += tipo.available_rooms;

            return acc;
        },
        {
            total: 0,
            activas: 0,
            disponibles: 0,
        }
        );
    }, [tipos]);

    return (
        <div className="flex min-h-full w-full flex-col">
        <PageHeader
            eyebrow=""
            titulo="Panel de habitaciones"
            descripcion="Visualizá la capacidad, tarifa y disponibilidad de cada tipo de habitación."
        />

        {error && (
            <div className="mt-4">
            <InfoBox tipo="error">
                {error}
            </InfoBox>
            </div>
        )}

        {/* Resumen general */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                <p className="text-sm text-carbon/60">
                    Tipos de habitación
                </p>

                <p className="mt-2 text-2xl font-bold text-carbon">
                    {tipos.length}
                </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold/15">
                <BedDouble
                    size={21}
                    className="text-carbon"
                />
                </div>
            </div>
            </div>

            <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                <p className="text-sm text-carbon/60">
                    Habitaciones totales
                </p>

                <p className="mt-2 text-2xl font-bold text-carbon">
                    {resumen.total}
                </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold/15">
                <DoorOpen
                    size={21}
                    className="text-carbon"
                />
                </div>
            </div>
            </div>

            <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                <p className="text-sm text-carbon/60">
                    Habitaciones activas
                </p>

                <p className="mt-2 text-2xl font-bold text-carbon">
                    {resumen.activas}
                </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold/15">
                <Users
                    size={21}
                    className="text-carbon"
                />
                </div>
            </div>
            </div>

            <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                <p className="text-sm text-carbon/60">
                    Disponibles ahora
                </p>

                <p className="mt-2 text-2xl font-bold text-carbon">
                    {resumen.disponibles}
                </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold/15">
                <BadgeDollarSign
                    size={21}
                    className="text-carbon"
                />
                </div>
            </div>
            </div>
        </div>

        {/* Filtro */}
        <div className="my-6 flex justify-end">
            <div className="w-48">
            <Select
                value={filtroEstado}
                onChange={(e) =>
                setFiltroEstado(e.target.value)
                }
            >
                <option value="ACTIVOS">
                Tipos activos
                </option>

                <option value="INACTIVOS">
                Tipos inactivos
                </option>

                <option value="TODOS">
                Todos
                </option>
            </Select>
            </div>
        </div>

        {/* Panel */}
        <Card
            titulo="Tipos de habitación"
            descripcion="Información consolidada de capacidad, precio y disponibilidad."
        >
            {cargando ? (
            <p className="py-10 text-center text-sm text-carbon/50">
                Cargando panel…
            </p>
            ) : tiposVisibles.length === 0 ? (
            <EmptyState
                titulo="No hay tipos para mostrar"
                descripcion="No se encontraron tipos de habitación para el filtro seleccionado."
            />
            ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {tiposVisibles.map((tipo) => {
                const porcentajeDisponible =
                    tipo.active_rooms > 0
                    ? Math.round(
                        (tipo.available_rooms /
                            tipo.active_rooms) *
                            100
                        )
                    : 0;

                return (
                    <div
                    key={tipo.room_type_id}
                    className="overflow-hidden rounded-xl border border-line bg-white shadow-sm"
                    >
                    {/* Header */}
                    <div className="border-b border-line px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-bold text-carbon">
                            {tipo.room_type_name}
                            </h3>

                            <p className="mt-1 text-sm text-carbon/60">
                            {tipo.description ||
                                "Sin descripción"}
                            </p>
                        </div>

                        <span
                            className={
                            tipo.active
                                ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                                : "rounded-full bg-carbon/10 px-3 py-1 text-xs font-semibold text-carbon/60"
                            }
                        >
                            {tipo.active
                            ? "Activo"
                            : "Inactivo"}
                        </span>
                        </div>
                    </div>

                    {/* Precio */}
                    <div className="bg-gold/10 px-5 py-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-carbon/50">
                        Tarifa vigente
                        </p>

                        <p className="mt-1 text-2xl font-bold text-carbon">
                        {formatearPrecio(
                            tipo.current_price,
                            tipo.currency || "ARS"
                        )}
                        </p>

                        {tipo.price_valid_from && (
                        <p className="mt-1 text-xs text-carbon/50">
                            Desde{" "}
                            {formatearFecha(
                            tipo.price_valid_from
                            )}
                        </p>
                        )}
                    </div>

                    {/* Información */}
                    <div className="grid grid-cols-2 gap-4 p-5">
                        <div>
                        <p className="text-xs text-carbon/50">
                            Capacidad
                        </p>

                        <p className="mt-1 font-semibold text-carbon">
                            {tipo.max_capacity}{" "}
                            {tipo.max_capacity === 1
                            ? "persona"
                            : "personas"}
                        </p>
                        </div>

                        <div>
                        <p className="text-xs text-carbon/50">
                            Camas
                        </p>

                        <p className="mt-1 font-semibold text-carbon">
                            {tipo.bed_setup || "-"}
                        </p>
                        </div>

                        <div>
                        <p className="text-xs text-carbon/50">
                            Habitaciones
                        </p>

                        <p className="mt-1 font-semibold text-carbon">
                            {tipo.active_rooms}
                        </p>
                        </div>

                        <div>
                        <p className="text-xs text-carbon/50">
                            Disponibles
                        </p>

                        <p className="mt-1 font-semibold text-carbon">
                            {tipo.available_rooms}
                        </p>
                        </div>
                    </div>

                    {/* Disponibilidad */}
                    <div className="border-t border-line px-5 py-4">
                        <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="text-carbon/60">
                            Disponibilidad
                        </span>

                        <span className="font-semibold text-carbon">
                            {porcentajeDisponible}%
                        </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-carbon/10">
                        <div
                            className="h-full rounded-full bg-gold transition-all"
                            style={{
                            width: `${Math.min(
                                100,
                                porcentajeDisponible
                            )}%`,
                            }}
                        />
                        </div>

                        <p className="mt-2 text-xs text-carbon/50">
                        {tipo.available_rooms} de{" "}
                        {tipo.active_rooms} habitación(es)
                        disponibles
                        </p>
                    </div>
                    </div>
                );
                })}
            </div>
            )}
        </Card>
        </div>
    );
    }