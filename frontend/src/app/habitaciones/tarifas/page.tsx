    "use client";

    import {
    FormEvent,
    useCallback,
    useEffect,
    useMemo,
    useState,
    } from "react";

import { Plus, X } from "lucide-react";
import Link from "next/link";

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
    active: boolean;
    room_type_id: number;
    base_price: string | number;
    currency: string;
    valid_from: string;
    valid_to: string | null;
    season_name: "GENERAL" | "ALTA" | "BAJA" | "ESPECIAL";
    reason: string | null;
    employees_id: number;

    room_type: TipoHabitacion;
    employees: Empleado;
}

interface ServicioPrecio {
    service_id: number;
    category: string;
    service_name: string;
    current_price: string | number;
    currency: string;
    active: boolean;
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

    function fechaHastaInclusiva(fecha: string | null) {
    if (!fecha) return "Sin fecha final";
    const [year, month, day] = fecha.slice(0, 10).split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day - 1));
    return formatearFecha(date.toISOString().slice(0, 10));
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

    const [editando, setEditando] = useState<Tarifa | null>(null);
    const [cambiando, setCambiando] = useState<number | null>(null);
    const [historial, setHistorial] = useState<Array<{history_id: number; changed_at: string; before_data: Tarifa; after_data: Tarifa; employees_name: string; employees_lastname: string}> | null>(null);
    const [servicios, setServicios] = useState<ServicioPrecio[]>([]);
    const [servicioEditando, setServicioEditando] = useState<ServicioPrecio | null>(null);
    const [errorServicio, setErrorServicio] = useState<string | null>(null);
    const [guardandoServicio, setGuardandoServicio] = useState(false);

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

    const [temporada, setTemporada] = useState<Tarifa["season_name"]>("GENERAL");

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
            const [
                tarifasData,
                tiposData,
                serviciosData,
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
                    api.get<ServicioPrecio[]>("/servicios-habitacion/catalogo"),
                ]
                );

            setTarifas(
                tarifasData
            );

            setTipos(
                tiposData
            );
            setServicios(serviciosData);
            setError(null);
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
        // cargar actualiza el estado después de recibir las respuestas HTTP.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        cargar();
    }, [cargar]);

    const hoy = fechaParaInput();

    const tarifasVigentes =
        useMemo(
        () =>
            tarifas.filter(
            (tarifa) => tarifa.active && tarifa.valid_from.slice(0, 10) <= hoy &&
                (!tarifa.valid_to || tarifa.valid_to.slice(0, 10) > hoy)
            ),
        [tarifas, hoy]
        );

    const tarifasFuturas = useMemo(
        () => tarifas.filter((tarifa) => tarifa.active && tarifa.valid_from.slice(0, 10) > hoy)
            .sort((a, b) => a.valid_from.localeCompare(b.valid_from)),
        [tarifas, hoy]
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

            const empieza = tarifa.valid_from.slice(0, 10);
            const termina = tarifa.valid_to?.slice(0, 10) ?? null;
            if (filtroEstado === "INACTIVAS" && tarifa.active) return false;
            if (["VIGENTES", "FUTURAS"].includes(filtroEstado) && !tarifa.active) return false;
            if (filtroEstado === "VIGENTES" && !(empieza <= hoy && (!termina || termina > hoy))) return false;
            if (filtroEstado === "FUTURAS" && empieza <= hoy) return false;
            if (filtroEstado === "HISTORICAS" && (!termina || termina > hoy)) return false;

            return true;
            }
        );
        }, [
        tarifas,
        filtroTipo,
        filtroEstado,
        hoy,
        ]);

    /**
     * Limpia formulario.
     */
    function limpiarFormulario() {
        setEditando(null);
        setTipoId("");
        setPrecio("");
        setMoneda("ARS");
        setTemporada("GENERAL");
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

        const payload = { room_type_id: Number(tipoId), base_price: precioNumero,
            currency: moneda, season_name: temporada, valid_from: fechaDesde, reason: motivo.trim() || null };
        const nuevaTarifa = editando
            ? await api.put<Tarifa>(`/tarifas/${editando.rate_id}`, payload)
            : await api.post<Tarifa>("/tarifas", payload);

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

    function editar(tarifa: Tarifa) {
        setEditando(tarifa); setTipoId(String(tarifa.room_type_id));
        setPrecio(String(tarifa.base_price)); setMoneda(tarifa.currency);
        setTemporada(tarifa.season_name); setFechaDesde(tarifa.valid_from.slice(0, 10));
        setMotivo(tarifa.reason || ""); setError(null); setAviso(null); setMostrarFormulario(true);
    }
    async function cambiarEstado(tarifa: Tarifa) {
        if (!window.confirm(tarifa.active
            ? "¿Desactivar esta tarifa? No se ofrecerá para nuevas reservas durante su período. Las reservas existentes conservan su precio."
            : "¿Activar esta tarifa para nuevas reservas dentro de su período?")) return;
        setCambiando(tarifa.rate_id); setError(null);
        try {
            await api.patch(`/tarifas/${tarifa.rate_id}/estado`, { active: !tarifa.active });
            await cargar(); setAviso(tarifa.active ? "Tarifa desactivada." : "Tarifa activada.");
        } catch (err) { setError(err instanceof Error ? err.message : "No se pudo cambiar el estado."); }
        finally { setCambiando(null); }
    }
    async function verHistorial(tarifa: Tarifa) {
        setError(null);
        try { setHistorial(await api.get<NonNullable<typeof historial>>(`/tarifas/${tarifa.rate_id}/cambios`)); }
        catch (err) { setError(err instanceof Error ? err.message : "No se pudo consultar el historial."); }
    }

    async function guardarServicio(event: FormEvent) {
        event.preventDefault();
        if (!servicioEditando || guardandoServicio) return;
        setErrorServicio(null);
        if (!servicioEditando.service_name.trim() || !Number.isFinite(Number(servicioEditando.current_price)) || Number(servicioEditando.current_price) <= 0) {
            setErrorServicio('Completá el nombre y un precio mayor que cero.'); return;
        }
        setGuardandoServicio(true);
        try {
            const actualizado = await api.patch<ServicioPrecio>(`/servicios-habitacion/catalogo/${servicioEditando.service_id}`, {
                service_name: servicioEditando.service_name.trim(), current_price: Number(servicioEditando.current_price),
                active: servicioEditando.active,
                employeeId: Number(window.localStorage.getItem('employeeId') ?? 1),
            });
            setServicios(actuales => actuales.map(s => s.service_id === actualizado.service_id ? actualizado : s));
            setServicioEditando(null);
            setAviso('Servicio actualizado. Los consumos ya registrados conservan su precio.');
        } catch (err) { setErrorServicio(err instanceof Error ? err.message : 'No se pudo guardar el servicio.'); }
        finally { setGuardandoServicio(false); }
    }

    return (
        <div className="flex min-h-full w-full flex-col">
        <PageHeader
            eyebrow=""
            titulo="Lista de precios"
            descripcion="Tarifas por temporada y precios vigentes de servicios y consumos."
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

                <span className="mt-2 inline-flex rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-carbon/75">
                    Temporada {tarifa.season_name === "GENERAL" ? "general" : tarifa.season_name.toLowerCase()}
                </span>

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

        {tarifasFuturas.length > 0 && (
            <Card className="mt-5" titulo="Próximos cambios de temporada" descripcion="Estas tarifas entrarán en vigencia en la fecha indicada; hasta entonces se mantiene el precio actual.">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {tarifasFuturas.slice(0, 6).map((tarifa) => (
                        <div key={tarifa.rate_id} className="flex items-center justify-between gap-4 rounded-lg border border-line bg-bone/25 p-4">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-carbon">{tarifa.room_type.room_type_name}</p>
                                <p className="mt-1 text-xs text-carbon/55">Temporada {tarifa.season_name === "GENERAL" ? "general" : tarifa.season_name.toLowerCase()} · desde {formatearFecha(tarifa.valid_from)}</p>
                            </div>
                            <p className="shrink-0 text-sm font-semibold tabular-nums text-carbon">{formatearPrecio(tarifa.base_price, tarifa.currency)}</p>
                        </div>
                    ))}
                </div>
            </Card>
        )}

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
                <option value="VIGENTES">Vigentes hoy</option>
                <option value="INACTIVAS">Inactivas</option>
                <option value="FUTURAS">Próximas tarifas</option>

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
                <table className="w-full min-w-225 text-left text-sm">
                <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-wide text-carbon/50">
                    <th className="px-4 py-3">
                        Tipo
                    </th>

                    <th className="px-4 py-3">
                        Precio
                    </th>

                    <th className="px-4 py-3">Temporada</th>

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
                    <th className="px-4 py-3">Acciones</th>
                    </tr>
                </thead>

                <tbody>
                    {tarifasVisibles.map(
                    (
                        tarifa
                    ) => {
                        const empieza = tarifa.valid_from.slice(0, 10);
                        const termina = tarifa.valid_to?.slice(0, 10) ?? null;
                        const vigente = tarifa.active && empieza <= hoy && (!termina || termina > hoy);
                        const futura = tarifa.active && empieza > hoy;

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

                            <td className="px-4 py-4">
                            <span className="rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-carbon/75">
                                {tarifa.season_name === "GENERAL" ? "General" : `Temporada ${tarifa.season_name.toLowerCase()}`}
                            </span>
                            </td>

                            <td className="px-4 py-4 text-carbon/70">
                            {formatearFecha(
                                tarifa.valid_from
                            )}
                            </td>

                            <td className="px-4 py-4 text-carbon/70">
                            {fechaHastaInclusiva(tarifa.valid_to)}
                            </td>

                            <td className="px-4 py-4">
                            <span
                                className={
                                vigente
                                    ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                                    : futura
                                    ? "rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700"
                                    : "rounded-full bg-carbon/10 px-3 py-1 text-xs font-semibold text-carbon/60"
                                }
                            >
                                {!tarifa.active ? "Inactiva" : vigente ? "Vigente hoy" : futura ? "Programada" : "Finalizada"}
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
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-2">
                                {(!termina || termina > hoy) && <>
                                  <button type="button" className="rounded border border-line px-3 py-1" onClick={() => editar(tarifa)}>Editar</button>
                                  <button type="button" className="rounded border border-line px-3 py-1" disabled={cambiando !== null} onClick={() => cambiarEstado(tarifa)}>
                                    {cambiando === tarifa.rate_id ? "Guardando..." : tarifa.active ? "Desactivar" : "Activar"}
                                  </button>
                                </>}
                                <button type="button" className="rounded border border-line px-3 py-1" onClick={() => verHistorial(tarifa)}>Ver cambios</button>
                              </div>
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

        <Card className="mt-6" titulo="Servicios y consumos" descripcion="Precios actuales del catálogo. Cada cargo de habitación conserva el precio aplicado al momento de registrarlo.">
            {servicios.length === 0 ? (
                <EmptyState titulo="No hay servicios" descripcion="Agregá servicios o consumos desde su catálogo." />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-140 text-left text-sm">
                        <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-carbon/50">
                            <th className="px-4 py-3">Servicio o consumo</th><th className="px-4 py-3">Categoría</th><th className="px-4 py-3 text-right">Precio actual</th>
                            <th className="px-4 py-3">Estado</th><th className="px-4 py-3">Acciones</th>
                        </tr></thead>
                        <tbody>{servicios.map((servicio) => (
                            <tr key={servicio.service_id} className="border-b border-line last:border-0">
                                <td className="px-4 py-3 font-medium text-carbon">{servicio.service_name}</td>
                                <td className="px-4 py-3 text-carbon/65">{servicio.category.replaceAll("_", " ")}</td>
                                <td className="px-4 py-3 text-right font-semibold tabular-nums text-carbon">{formatearPrecio(servicio.current_price, servicio.currency)}</td>
                                <td className="px-4 py-3">{servicio.active ? 'Activo' : 'Inactivo'}</td>
                                <td className="px-4 py-3"><button type="button" className="rounded border border-line px-3 py-1" onClick={() => { setServicioEditando({ ...servicio }); setErrorServicio(null); }}>Editar</button></td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}
            <div className="mt-4 flex justify-end">
                <Link href="/habitaciones/servicios" className="rounded-md border border-line px-4 py-2 text-sm font-medium text-carbon hover:bg-bone/50">Administrar servicios y precios</Link>
            </div>
        </Card>

        {servicioEditando && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div role="dialog" aria-modal="true" aria-labelledby="editar-servicio-titulo" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
                <h2 id="editar-servicio-titulo" className="mb-4 text-xl font-semibold">Editar servicio o consumo</h2>
                <form onSubmit={guardarServicio} className="space-y-4">
                    {errorServicio && <p role="alert" className="text-sm text-red-700">{errorServicio}</p>}
                    <label className="block text-sm">Nombre<Input autoFocus value={servicioEditando.service_name} required maxLength={100} disabled={guardandoServicio} onChange={e => setServicioEditando({ ...servicioEditando, service_name: e.target.value })} /></label>
                    <label className="block text-sm">Precio ({servicioEditando.currency})<Input type="number" min="0.01" step="0.01" required value={servicioEditando.current_price} disabled={guardandoServicio} onChange={e => setServicioEditando({ ...servicioEditando, current_price: e.target.value })} /></label>
                    <label className="block text-sm">Estado<Select value={String(servicioEditando.active)} disabled={guardandoServicio} onChange={e => setServicioEditando({ ...servicioEditando, active: e.target.value === 'true' })}><option value="true">Activo</option><option value="false">Inactivo</option></Select></label>
                    <p className="text-sm text-carbon/65">El nuevo precio se aplica a futuros consumos. Los ya cargados conservan su importe.</p>
                    <div className="flex justify-end gap-3">
                        <button type="button" disabled={guardandoServicio} className="rounded border border-line px-4 py-2" onClick={() => setServicioEditando(null)}>Cancelar</button>
                        <button type="submit" disabled={guardandoServicio} className="rounded bg-gold px-4 py-2 font-semibold">{guardandoServicio ? 'Guardando...' : 'Guardar cambios'}</button>
                    </div>
                </form>
            </div>
        </div>}

        {historial !== null && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div role="dialog" aria-modal="true" aria-label="Historial de cambios de tarifa" className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-6">
            <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Cambios de la tarifa</h2>
              <button type="button" onClick={() => setHistorial(null)} className="rounded border px-3 py-1">Cerrar</button></div>
            {!historial.length && <p className="mt-4">No hay modificaciones registradas.</p>}
            {historial.map((item) => <div key={item.history_id} className="mt-4 border-t pt-3 text-sm">
              <p>{new Date(item.changed_at).toLocaleString("es-AR")} · {item.employees_name} {item.employees_lastname}</p>
              <p>Precio: {formatearPrecio(item.before_data.base_price, item.before_data.currency)} → {formatearPrecio(item.after_data.base_price, item.after_data.currency)}</p>
              <p>Estado: {item.before_data.active ? "Activa" : "Inactiva"} → {item.after_data.active ? "Activa" : "Inactiva"}</p>
              <p>Temporada: {item.before_data.season_name} → {item.after_data.season_name}</p>
              <p>Motivo: {item.before_data.reason || "—"} → {item.after_data.reason || "—"}</p>
            </div>)}
          </div>
        </div>}
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
                    {editando ? "Editar tarifa" : "Registrar nueva tarifa"}
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
                {error && <div role="alert" className="md:col-span-2 text-sm text-red-700">{error}</div>}
                {/* Tipo */}
                <div>
                    <label className="mb-2 block text-sm font-medium text-carbon">
                    Tipo de
                    habitación
                    </label>

                    <Select
                    disabled={!!editando}
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

                <div>
                    <label className="mb-2 block text-sm font-medium text-carbon">Temporada</label>
                    <Select value={temporada} onChange={(e) => setTemporada(e.target.value as Tarifa["season_name"])}>
                        <option value="GENERAL">General</option>
                        <option value="ALTA">Temporada alta</option>
                        <option value="BAJA">Temporada baja</option>
                        <option value="ESPECIAL">Especial / feriado</option>
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
                    disabled={!!editando}
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
                        Programá los cambios cargando una tarifa por fecha: por ejemplo, una temporada alta para diciembre y luego una tarifa general o baja desde enero. El precio anterior queda vigente hasta el día previo al próximo cambio.
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
