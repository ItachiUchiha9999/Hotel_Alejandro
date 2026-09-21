    "use client";

    import {
    FormEvent,
    useCallback,
    useEffect,
    useMemo,
    useState,
    } from "react";

    import { Plus, X } from "lucide-react";

    import { PageHeader } from "@/components/layout/PageHeader";

    import {
    Card,
    EmptyState,
    InfoBox,
    Input,
    Select,
    } from "@/components/ui";

    import { api, ApiError } from "@/lib/api";

    interface TipoHabitacion {
    room_type_id: number;
    room_type_name: string;
    room_type_max_capacity: number;
    room_type_state: boolean;
    }

    interface Empleado {
    employees_id: number;
    employees_name: string;
    employees_lastname: string;
    }

    interface Tarifa {
    rate_id: number;
    room_type_id: number;
    base_price: string | number;
    currency: string;
    valid_from: string;
    valid_to: string | null;
    reason: string | null;
    employees_id: number;

    room_type: TipoHabitacion;
    employees: Empleado;
    }

    /**
     * Fecha actual en formato YYYY-MM-DD
     * para usar en input type="date".
     */
    function fechaParaInput() {
    const hoy = new Date();

    const year = hoy.getFullYear();
    const month = String(
        hoy.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        hoy.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
    }

    /**
     * Convierte una fecha ISO a DD/MM/YYYY.
     */
    function formatearFecha(
    fecha: string | null
    ) {
    if (!fecha) {
        return "Actual";
    }

    const valor =
        fecha.slice(0, 10);

    const [
        year,
        month,
        day,
    ] = valor.split("-");

    return `${day}/${month}/${year}`;
    }

    /**
     * Formatea precio según moneda.
     */
    function formatearPrecio(
    precio: string | number,
    moneda = "ARS"
    ) {
    const numero = Number(precio);

    if (!Number.isFinite(numero)) {
        return "-";
    }

    return new Intl.NumberFormat(
        "es-AR",
        {
        style: "currency",
        currency: moneda,
        maximumFractionDigits: 0,
        }
    ).format(numero);
    }

    export default function TarifasPage() {
    const [
        tarifas,
        setTarifas,
    ] = useState<Tarifa[]>([]);

    const [
        tipos,
        setTipos,
    ] = useState<
        TipoHabitacion[]
    >([]);

    const [
        cargando,
        setCargando,
    ] = useState(true);

    const [
        guardando,
        setGuardando,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState<
        string | null
    >(null);

    const [
        aviso,
        setAviso,
    ] = useState<
        string | null
    >(null);

    const [
        mostrarFormulario,
        setMostrarFormulario,
    ] = useState(false);

    /**
     * Formulario.
     */
    const [
        tipoId,
        setTipoId,
    ] = useState("");

    const [
        precio,
        setPrecio,
    ] = useState("");

    const [
        moneda,
        setMoneda,
    ] = useState("ARS");

    const [
        fechaDesde,
        setFechaDesde,
    ] = useState(
        fechaParaInput()
    );

    const [
        motivo,
        setMotivo,
    ] = useState("");

    /**
     * Filtros.
     */
    const [
        filtroTipo,
        setFiltroTipo,
    ] = useState("");

    const [
        filtroEstado,
        setFiltroEstado,
    ] = useState(
        "VIGENTES"
    );

    /**
     * Cargar tarifas y tipos.
     */
    const cargar =
        useCallback(
        async () => {
            try {
            setCargando(
                true
            );

            setError(
                null
            );

            const [
                tarifasData,
                tiposData,
            ] =
                await Promise.all(
                [
                    api.get<
                    Tarifa[]
                    >(
                    "/tarifas"
                    ),

                    api.get<
                    TipoHabitacion[]
                    >(
                    "/tipos-habitacion?activos=true"
                    ),
                ]
                );

            setTarifas(
                tarifasData
            );

            setTipos(
                tiposData
            );
            } catch (err) {
            setError(
                err instanceof
                ApiError
                ? err.message
                : "No se pudieron cargar las tarifas."
            );
            } finally {
            setCargando(
                false
            );
            }
        },
        []
        );

    useEffect(() => {
        cargar();
    }, [cargar]);

    /**
     * Tarifas vigentes.
     */
    const tarifasVigentes =
        useMemo(
        () =>
            tarifas.filter(
            (tarifa) =>
                tarifa.valid_to ===
                null
            ),
        [tarifas]
        );

    /**
     * Tarifas filtradas.
     */
    const tarifasVisibles =
        useMemo(() => {
        return tarifas.filter(
            (tarifa) => {
            if (
                filtroTipo &&
                String(
                tarifa.room_type_id
                ) !==
                filtroTipo
            ) {
                return false;
            }

            if (
                filtroEstado ===
                "VIGENTES" &&
                tarifa.valid_to !==
                null
            ) {
                return false;
            }

            if (
                filtroEstado ===
                "HISTORICAS" &&
                tarifa.valid_to ===
                null
            ) {
                return false;
            }

            return true;
            }
        );
        }, [
        tarifas,
        filtroTipo,
        filtroEstado,
        ]);

    /**
     * Limpia formulario.
     */
    function limpiarFormulario() {
        setTipoId("");
        setPrecio("");
        setMoneda("ARS");
        setFechaDesde(
        fechaParaInput()
        );
        setMotivo("");
    }

    /**
     * Abrir modal.
     */
    function abrirFormulario() {
        limpiarFormulario();

        setError(null);
        setAviso(null);

        setMostrarFormulario(
        true
        );
    }

    /**
     * Cerrar modal.
     */
    function cancelarFormulario() {
        if (guardando) {
        return;
        }

        limpiarFormulario();

        setMostrarFormulario(
        false
        );
    }

    /**
     * Guardar tarifa.
     */
    async function guardarTarifa(
        event: FormEvent
    ) {
        event.preventDefault();

        setError(null);
        setAviso(null);

        if (!tipoId) {
        setError(
            "Elegí un tipo de habitación."
        );

        return;
        }

        const precioNumero =
        Number(precio);

        if (
        !Number.isFinite(
            precioNumero
        ) ||
        precioNumero <= 0
        ) {
        setError(
            "Ingresá un precio mayor que cero."
        );

        return;
        }

        if (!fechaDesde) {
        setError(
            "Ingresá la fecha desde la cual estará vigente."
        );

        return;
        }

        try {
        setGuardando(
            true
        );

        const nuevaTarifa =
            await api.post<Tarifa>(
            "/tarifas",
            {
                room_type_id:
                Number(
                    tipoId
                ),

                base_price:
                precioNumero,

                currency:
                moneda,

                valid_from:
                fechaDesde,

                reason:
                motivo.trim() ||
                null,
            }
            );

        setAviso(
            `La nueva tarifa de ${nuevaTarifa.room_type.room_type_name} se registró correctamente.`
        );

        limpiarFormulario();

        setMostrarFormulario(
            false
        );

        await cargar();
        } catch (err) {
        setError(
            err instanceof
            ApiError
            ? err.message
            : "No se pudo registrar la tarifa."
        );
        } finally {
        setGuardando(
            false
        );
        }
    }

    return (
        <div className="flex min-h-full w-full flex-col">
        <PageHeader
            eyebrow=""
            titulo="Tarifas"
            descripcion="Administrá los precios por tipo de habitación y consultá su historial."
        />

        {/* Mensajes */}
        {(error ||
            aviso) && (
            <div className="mb-5 mt-4 flex flex-col gap-3">
            {error && (
                <InfoBox tipo="error">
                {error}
                </InfoBox>
            )}

            {aviso && (
                <InfoBox tipo="exito">
                {aviso}
                </InfoBox>
            )}
            </div>
        )}

        {/* Tarifas vigentes */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {tarifasVigentes.map(
            (tarifa) => (
                <div
                key={
                    tarifa.rate_id
                }
                className="rounded-xl border border-line bg-white p-5 shadow-sm"
                >
                <p className="text-xs font-semibold uppercase tracking-wide text-carbon/50">
                    {
                    tarifa
                        .room_type
                        .room_type_name
                    }
                </p>

                <p className="mt-2 text-2xl font-bold text-carbon">
                    {formatearPrecio(
                    tarifa.base_price,
                    tarifa.currency
                    )}
                </p>

                <p className="mt-1 text-sm text-carbon/60">
                    por noche
                </p>

                <div className="mt-4 border-t border-line pt-3">
                    <p className="text-xs text-carbon/50">
                    Vigente desde{" "}
                    {formatearFecha(
                        tarifa.valid_from
                    )}
                    </p>
                </div>
                </div>
            )
            )}
        </div>

        {/* Botón */}
        <div className="my-6 flex justify-end">
            <button
            type="button"
            onClick={
                abrirFormulario
            }
            className="flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-carbon shadow-sm transition-colors hover:bg-gold-dark"
            >
            <Plus size={16} />

            Nueva tarifa
            </button>
        </div>

        {/* Historial */}
        <Card
            titulo="Historial de tarifas"
            descripcion="Consultá las tarifas vigentes y anteriores de cada tipo de habitación."
        >
            <div className="mb-5 flex flex-wrap gap-3">
            {/* Filtro tipo */}
            <div className="w-48">
                <Select
                value={
                    filtroTipo
                }
                onChange={(
                    e
                ) =>
                    setFiltroTipo(
                    e.target
                        .value
                    )
                }
                >
                <option value="">
                    Todos los tipos
                </option>

                {tipos.map(
                    (tipo) => (
                    <option
                        key={
                        tipo.room_type_id
                        }
                        value={
                        tipo.room_type_id
                        }
                    >
                        {
                        tipo.room_type_name
                        }
                    </option>
                    )
                )}
                </Select>
            </div>

            {/* Filtro estado */}
            <div className="w-48">
                <Select
                value={
                    filtroEstado
                }
                onChange={(
                    e
                ) =>
                    setFiltroEstado(
                    e.target
                        .value
                    )
                }
                >
                <option value="VIGENTES">
                    Tarifas vigentes
                </option>

                <option value="HISTORICAS">
                    Tarifas anteriores
                </option>

                <option value="TODAS">
                    Todas
                </option>
                </Select>
            </div>
            </div>

            {cargando ? (
            <p className="py-10 text-center text-sm text-carbon/50">
                Cargando
                tarifas…
            </p>
            ) : tarifasVisibles.length ===
            0 ? (
            <EmptyState
                titulo="No hay tarifas para mostrar"
                descripcion="No se encontraron tarifas con los filtros seleccionados."
            />
            ) : (
            <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-wide text-carbon/50">
                    <th className="px-4 py-3">
                        Tipo
                    </th>

                    <th className="px-4 py-3">
                        Precio
                    </th>

                    <th className="px-4 py-3">
                        Desde
                    </th>

                    <th className="px-4 py-3">
                        Hasta
                    </th>

                    <th className="px-4 py-3">
                        Estado
                    </th>

                    <th className="px-4 py-3">
                        Motivo
                    </th>

                    <th className="px-4 py-3">
                        Responsable
                    </th>
                    </tr>
                </thead>

                <tbody>
                    {tarifasVisibles.map(
                    (
                        tarifa
                    ) => {
                        const vigente =
                        tarifa.valid_to ===
                        null;

                        return (
                        <tr
                            key={
                            tarifa.rate_id
                            }
                            className="border-b border-line last:border-b-0"
                        >
                            <td className="px-4 py-4 font-semibold text-carbon">
                            {
                                tarifa
                                .room_type
                                .room_type_name
                            }
                            </td>

                            <td className="px-4 py-4 font-semibold text-carbon">
                            {formatearPrecio(
                                tarifa.base_price,
                                tarifa.currency
                            )}
                            </td>

                            <td className="px-4 py-4 text-carbon/70">
                            {formatearFecha(
                                tarifa.valid_from
                            )}
                            </td>

                            <td className="px-4 py-4 text-carbon/70">
                            {vigente
                                ? "-"
                                : formatearFecha(
                                    tarifa.valid_to
                                )}
                            </td>

                            <td className="px-4 py-4">
                            <span
                                className={
                                vigente
                                    ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                                    : "rounded-full bg-carbon/10 px-3 py-1 text-xs font-semibold text-carbon/60"
                                }
                            >
                                {vigente
                                ? "Vigente"
                                : "Finalizada"}
                            </span>
                            </td>

                            <td className="px-4 py-4 text-carbon/70">
                            {tarifa.reason ||
                                "-"}
                            </td>

                            <td className="px-4 py-4 text-carbon/70">
                            {
                                tarifa
                                .employees
                                .employees_name
                            }{" "}
                            {
                                tarifa
                                .employees
                                .employees_lastname
                            }
                            </td>
                        </tr>
                        );
                    }
                    )}
                </tbody>
                </table>
            </div>
            )}
        </Card>

        {/* MODAL NUEVA TARIFA */}
        {mostrarFormulario && (
            <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
            onMouseDown={(
                event
            ) => {
                if (
                event.target ===
                event.currentTarget
                ) {
                cancelarFormulario();
                }
            }}
            >
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
                {/* Encabezado modal */}
                <div className="flex items-start justify-between border-b border-line px-6 py-5">
                <div>
                    <h2 className="text-xl font-semibold text-carbon">
                    Registrar
                    nueva tarifa
                    </h2>

                    <p className="mt-1 text-sm text-carbon/60">
                    La tarifa
                    anterior se
                    conservará en
                    el historial.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={
                    cancelarFormulario
                    }
                    disabled={
                    guardando
                    }
                    aria-label="Cerrar"
                    className="flex h-9 w-9 items-center justify-center rounded-md text-carbon/50 transition-colors hover:bg-carbon/5 hover:text-carbon disabled:opacity-50"
                >
                    <X
                    size={
                        19
                    }
                    />
                </button>
                </div>

                {/* Formulario */}
                <form
                onSubmit={
                    guardarTarifa
                }
                className="grid gap-5 p-6 md:grid-cols-2"
                >
                {/* Tipo */}
                <div>
                    <label className="mb-2 block text-sm font-medium text-carbon">
                    Tipo de
                    habitación
                    </label>

                    <Select
                    value={
                        tipoId
                    }
                    onChange={(
                        e
                    ) =>
                        setTipoId(
                        e
                            .target
                            .value
                        )
                    }
                    required
                    >
                    <option value="">
                        Seleccionar
                        tipo...
                    </option>

                    {tipos.map(
                        (
                        tipo
                        ) => (
                        <option
                            key={
                            tipo.room_type_id
                            }
                            value={
                            tipo.room_type_id
                            }
                        >
                            {
                            tipo.room_type_name
                            }
                        </option>
                        )
                    )}
                    </Select>
                </div>

                {/* Precio */}
                <div>
                    <label className="mb-2 block text-sm font-medium text-carbon">
                    Precio por
                    noche
                    </label>

                    <Input
                    type="number"
                    min="1"
                    step="0.01"
                    value={
                        precio
                    }
                    onChange={(
                        e
                    ) =>
                        setPrecio(
                        e
                            .target
                            .value
                        )
                    }
                    placeholder="Ej. 75000"
                    required
                    />
                </div>

                {/* Moneda */}
                <div>
                    <label className="mb-2 block text-sm font-medium text-carbon">
                    Moneda
                    </label>

                    <Select
                    value={
                        moneda
                    }
                    onChange={(
                        e
                    ) =>
                        setMoneda(
                        e
                            .target
                            .value
                        )
                    }
                    >
                    <option value="ARS">
                        ARS —
                        Pesos
                        argentinos
                    </option>

                    <option value="USD">
                        USD —
                        Dólares
                    </option>
                    </Select>
                </div>

                {/* Fecha */}
                <div>
                    <label className="mb-2 block text-sm font-medium text-carbon">
                    Vigente desde
                    </label>

                    <Input
                    type="date"
                    value={
                        fechaDesde
                    }
                    onChange={(
                        e
                    ) =>
                        setFechaDesde(
                        e
                            .target
                            .value
                        )
                    }
                    required
                    />
                </div>

                {/* Motivo */}
                <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-carbon">
                    Motivo del
                    cambio
                    </label>

                    <Input
                    type="text"
                    value={
                        motivo
                    }
                    onChange={(
                        e
                    ) =>
                        setMotivo(
                        e
                            .target
                            .value
                        )
                    }
                    placeholder="Ej. Actualización de temporada"
                    maxLength={
                        255
                    }
                    />
                </div>

                {/* Nota */}
                <div className="md:col-span-2">
                    <div className="rounded-lg border border-gold/30 bg-gold/10 px-4 py-3">
                    <p className="text-sm text-carbon/70">
                        Al registrar
                        una nueva
                        tarifa, la
                        tarifa vigente
                        anterior se
                        cierra
                        automáticamente
                        y queda
                        guardada en el
                        historial.
                    </p>
                    </div>
                </div>

                {/* Botones */}
                <div className="flex justify-end gap-3 border-t border-line pt-5 md:col-span-2">
                    <button
                    type="button"
                    onClick={
                        cancelarFormulario
                    }
                    disabled={
                        guardando
                    }
                    className="rounded-md border border-line px-4 py-2 text-sm font-medium text-carbon transition-colors hover:bg-carbon/5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                    Cancelar
                    </button>

                    <button
                    type="submit"
                    disabled={
                        guardando
                    }
                    className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-carbon shadow-sm transition-colors hover:bg-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
                    >
                    {guardando
                        ? "Guardando..."
                        : "Guardar tarifa"}
                    </button>
                </div>
                </form>
            </div>
            </div>
        )}
        </div>
    );
    }