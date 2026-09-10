    "use client";

    import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    } from "react";

    import { PageHeader } from "@/components/layout/PageHeader";

    import {
    Badge,
    Button,
    Card,
    EmptyState,
    Field,
    FieldGrid,
    InfoBox,
    Input,
    Select,
    Table,
    THead,
    TH,
    TBody,
    TR,
    TD,
    } from "@/components/ui";

    import { api, ApiError } from "@/lib/api";

    import type {
    Articulo,
    Proveedor,
    } from "@/lib/types";

    /* ============================================================
    COMPRADOR
    ============================================================ */

    const COMPRADOR = {
    nombre: "Hotel Alejandro I",
    cuit: "CUIT a completar",
    direccion: "Salta, Argentina",
    };

    /* ============================================================
    TIPOS
    ============================================================ */

    type EstadoOrden =
    | "BORRADOR"
    | "EMITIDA"
    | "APROBADA"
    | "RECIBIDA"
    | "CANCELADA";

    interface ProveedorOrden extends Proveedor {
    supplier_address?: string | null;
    }

    interface DetalleOrden {
    article_id: number | null;
    item_description: string;
    quantity: number;
    unit_price: number;
    }

    interface HistorialEstado {
    status_history_id: number;
    previous_status: string | null;
    new_status: string;
    changed_at: string;

    employees?: {
        employees_name: string;
        employees_lastname: string;
    };
    }

    interface ComprobanteOrden {
    voucher_id: number;
    voucher_number: string;
    total_amount: string | number;
    voucher_status: string;
    issue_date: string;
    }

    interface OrdenCompra {
    purchase_order_id: number;
    purchase_order_number: string;

    supplier_id: number;

    issue_date: string;
    expected_date: string | null;

    purchase_conditions: string | null;

    purchase_order_status: EstadoOrden;

    total_amount: string | number;

    observations: string | null;

    suppliers: {
        supplier_id: number;
        supplier_legal_name: string;
        supplier_trade_name: string | null;
        supplier_state: boolean;
        supplier_cuit?: string;
        supplier_address?: string | null;
    };

    employees?: {
        employees_id: number;
        employees_name: string;
        employees_lastname: string;
    };

    purchase_order_detail: Array<{
        purchase_detail_id: number;
        article_id: number | null;
        item_description: string;
        quantity: string | number;
        unit_price: string | number;

        articles?: {
        article_id: number;
        article_code: string;
        article_name: string;
        } | null;
    }>;

    status_history?: HistorialEstado[];

    supplier_voucher?: ComprobanteOrden[];

    _count?: {
        purchase_order_detail: number;
    };
    }

    /* ============================================================
    HELPERS
    ============================================================ */

    const plata = (valor: string | number) =>
    Number(valor).toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    const precioInput = (valor: number) => {
    if (!valor) return "";

    return Math.trunc(valor).toLocaleString("es-AR", {
        maximumFractionDigits: 0,
    });
    };

    const fecha = (valor: string | null) => {
    if (!valor) return "—";

    return new Date(valor).toLocaleDateString("es-AR", {
        timeZone: "UTC",
    });
    };

    const fechaHora = (valor: string) =>
    new Date(valor).toLocaleString("es-AR");

    const tonoEstado = {
    BORRADOR: "alerta",
    EMITIDA: "alerta",
    APROBADA: "activo",
    RECIBIDA: "activo",
    CANCELADA: "inactivo",
    } as const;

    /* ============================================================
    COMPONENTE
    ============================================================ */

    export default function OrdenesCompraPage() {
    const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);

    const [proveedores, setProveedores] =
        useState<ProveedorOrden[]>([]);

    const [articulos, setArticulos] =
        useState<Articulo[]>([]);

    const [cargando, setCargando] = useState(true);

    const [error, setError] =
        useState<string | null>(null);

    const [mensaje, setMensaje] =
        useState<string | null>(null);

    /* ============================================================
        FILTROS
    ============================================================ */

    const [filtroProveedor, setFiltroProveedor] =
        useState("");

    const [filtroEstado, setFiltroEstado] =
        useState("");

    /* ============================================================
        MODAL NUEVA ORDEN
    ============================================================ */

    const [mostrarFormulario, setMostrarFormulario] =
        useState(false);

    const [guardando, setGuardando] =
        useState(false);

    const [proveedorId, setProveedorId] =
        useState("");

    const [fechaEmision, setFechaEmision] =
        useState(
        new Date().toISOString().slice(0, 10)
        );

    const [lugarEmision, setLugarEmision] =
        useState("Salta");

    const [fechaEntrega, setFechaEntrega] =
        useState("");

    const [condicionPago, setCondicionPago] =
        useState("");

    const [condicionEntrega, setCondicionEntrega] =
        useState("");

    const [observaciones, setObservaciones] =
        useState("");

    const [detalles, setDetalles] =
        useState<DetalleOrden[]>([
        {
            article_id: null,
            item_description: "",
            quantity: 1,
            unit_price: 0,
        },
        ]);

    /* ============================================================
        MODAL DETALLE
    ============================================================ */

    const [ordenDetalle, setOrdenDetalle] =
        useState<OrdenCompra | null>(null);

    const [cargandoDetalle, setCargandoDetalle] =
        useState(false);

    /* ============================================================
        PROVEEDOR SELECCIONADO
    ============================================================ */

    const proveedorSeleccionado = useMemo(
        () =>
        proveedores.find(
            (proveedor) =>
            proveedor.supplier_id === Number(proveedorId)
        ) ?? null,
        [proveedores, proveedorId]
    );

    /* ============================================================
        CARGAR CATÁLOGOS
    ============================================================ */

    const cargarCatalogos = useCallback(async () => {
        try {
        const [prov, arts] = await Promise.all([
            api.get<ProveedorOrden[]>(
            "/proveedores?activos=true"
            ),

            api.get<Articulo[]>(
            "/articulos"
            ),
        ]);

        setProveedores(
            prov.filter(
            (proveedor) => proveedor.supplier_state
            )
        );

        setArticulos(arts);
        } catch (err) {
        setError(
            err instanceof ApiError
            ? err.message
            : "No se pudieron cargar proveedores y artículos."
        );
        }
    }, []);

    /* ============================================================
        CARGAR ÓRDENES
    ============================================================ */

    const cargarOrdenes = useCallback(async () => {
        setCargando(true);
        setError(null);

        try {
        const params = new URLSearchParams();

        if (filtroProveedor) {
            params.set(
            "supplier_id",
            filtroProveedor
            );
        }

        if (filtroEstado) {
            params.set(
            "estado",
            filtroEstado
            );
        }

        const query = params.toString();

        const data =
            await api.get<OrdenCompra[]>(
            `/ordenes-compra${
                query ? `?${query}` : ""
            }`
            );

        setOrdenes(data);
        } catch (err) {
        setError(
            err instanceof ApiError
            ? err.message
            : "No se pudieron cargar las órdenes de compra."
        );
        } finally {
        setCargando(false);
        }
    }, [filtroProveedor, filtroEstado]);

    useEffect(() => {
        cargarCatalogos();
    }, [cargarCatalogos]);

    useEffect(() => {
        cargarOrdenes();
    }, [cargarOrdenes]);

    /* ============================================================
        VER DETALLE
    ============================================================ */

    const verDetalle = async (
        ordenId: number
    ) => {
        setError(null);
        setCargandoDetalle(true);

        try {
        const data =
            await api.get<OrdenCompra>(
            `/ordenes-compra/${ordenId}`
            );

        setOrdenDetalle(data);
        } catch (err) {
        setError(
            err instanceof ApiError
            ? err.message
            : "No se pudo cargar el detalle de la orden."
        );
        } finally {
        setCargandoDetalle(false);
        }
    };

    /* ============================================================
        DETALLES NUEVA ORDEN
    ============================================================ */

    const agregarDetalle = () => {
        setDetalles((actual) => [
        ...actual,
        {
            article_id: null,
            item_description: "",
            quantity: 1,
            unit_price: 0,
        },
        ]);
    };

    const quitarDetalle = (
        indice: number
    ) => {
        setDetalles((actual) => {
        if (actual.length === 1) {
            return [
            {
                article_id: null,
                item_description: "",
                quantity: 1,
                unit_price: 0,
            },
            ];
        }

        return actual.filter(
            (_, i) => i !== indice
        );
        });
    };

    const actualizarDetalle = (
        indice: number,
        campo: keyof DetalleOrden,
        valor: string | number | null
    ) => {
        setDetalles((actual) =>
        actual.map((detalle, i) =>
            i === indice
            ? {
                ...detalle,
                [campo]: valor,
                }
            : detalle
        )
        );
    };

    const seleccionarArticulo = (
        indice: number,
        value: string
    ) => {
        if (!value) {
        setDetalles((actual) =>
            actual.map((detalle, i) =>
            i === indice
                ? {
                    ...detalle,
                    article_id: null,
                    item_description: "",
                }
                : detalle
            )
        );

        return;
        }

        const id = Number(value);

        const articulo =
        articulos.find(
            (item) =>
            item.article_id === id
        );

        setDetalles((actual) =>
        actual.map((detalle, i) =>
            i === indice
            ? {
                ...detalle,
                article_id: id,
                item_description:
                    articulo?.article_name ??
                    detalle.item_description,
                }
            : detalle
        )
        );
    };

    /* ============================================================
        TOTAL NUEVA ORDEN
    ============================================================ */

    const total = useMemo(
        () =>
        detalles.reduce(
            (acumulado, detalle) => {
            const cantidad =
                Number(detalle.quantity) || 0;

            const precio =
                Number(detalle.unit_price) || 0;

            return (
                acumulado +
                cantidad * precio
            );
            },
            0
        ),
        [detalles]
    );

    /* ============================================================
        LIMPIAR FORMULARIO
    ============================================================ */

    const limpiarFormulario = () => {
        setProveedorId("");

        setFechaEmision(
        new Date().toISOString().slice(0, 10)
        );

        setLugarEmision("Salta");
        setFechaEntrega("");
        setCondicionPago("");
        setCondicionEntrega("");
        setObservaciones("");

        setDetalles([
        {
            article_id: null,
            item_description: "",
            quantity: 1,
            unit_price: 0,
        },
        ]);
    };

    const abrirFormulario = () => {
        limpiarFormulario();

        setError(null);
        setMensaje(null);

        setMostrarFormulario(true);
    };

    const cerrarFormulario = () => {
        if (guardando) return;

        setMostrarFormulario(false);
    };

    /* ============================================================
        GUARDAR ORDEN
    ============================================================ */

    const guardarOrden = async (
        emitir: boolean
    ) => {
        setError(null);
        setMensaje(null);

        if (!proveedorId) {
        setError(
            "Seleccioná un proveedor."
        );

        return;
        }

        if (!fechaEmision) {
        setError(
            "Ingresá la fecha de emisión."
        );

        return;
        }

        if (!lugarEmision.trim()) {
        setError(
            "Ingresá el lugar de emisión."
        );

        return;
        }

        const detallesValidos =
        detalles.filter(
            (detalle) =>
            detalle.item_description.trim() &&
            Number(detalle.quantity) > 0 &&
            Number(detalle.unit_price) > 0
        );

        if (
        emitir &&
        detallesValidos.length === 0
        ) {
        setError(
            "Para emitir la orden tenés que agregar al menos un artículo o servicio."
        );

        return;
        }

        const condicionesCompra = [
        `Lugar de emisión: ${lugarEmision.trim()}`,

        `Pago: ${
            condicionPago.trim() ||
            "No especificado"
        }`,

        `Entrega: ${
            condicionEntrega.trim() ||
            "No especificada"
        }`,
        ].join(" | ");

        setGuardando(true);

        try {
        await api.post(
            "/ordenes-compra",
            {
            supplier_id:
                Number(proveedorId),

            issue_date:
                fechaEmision,

            expected_date:
                fechaEntrega || null,

            purchase_conditions:
                condicionesCompra,

            observations:
                observaciones.trim() ||
                null,

            detalles:
                detallesValidos.map(
                (detalle) => ({
                    article_id:
                    detalle.article_id,

                    item_description:
                    detalle
                        .item_description
                        .trim(),

                    quantity:
                    Number(
                        detalle.quantity
                    ),

                    unit_price:
                    Number(
                        detalle.unit_price
                    ),
                })
                ),

            emitir,
            }
        );

        setMostrarFormulario(false);

        setMensaje(
            emitir
            ? "Orden de compra emitida correctamente."
            : "Orden guardada como borrador."
        );

        limpiarFormulario();

        await cargarOrdenes();
        } catch (err) {
        setError(
            err instanceof ApiError
            ? err.message
            : "No se pudo registrar la orden."
        );
        } finally {
        setGuardando(false);
        }
    };

    /* ============================================================
        CAMBIAR ESTADO
    ============================================================ */

    const cambiarEstado = async (
        orden: OrdenCompra,
        estado: EstadoOrden
    ) => {
        setError(null);
        setMensaje(null);

        try {
        await api.patch(
            `/ordenes-compra/${orden.purchase_order_id}/estado`,
            {
            estado,
            }
        );

        await cargarOrdenes();

        if (
            ordenDetalle?.purchase_order_id ===
            orden.purchase_order_id
        ) {
            await verDetalle(
            orden.purchase_order_id
            );
        }
        } catch (err) {
        setError(
            err instanceof ApiError
            ? err.message
            : "No se pudo actualizar el estado de la orden."
        );
        }
    };

    /* ============================================================
        RENDER
    ============================================================ */

    return (
        <>
        <PageHeader
            eyebrow=""
            titulo="Órdenes de compra"
            descripcion=""
            acciones={
            <Button
                onClick={
                abrirFormulario
                }
            >
                Nueva orden de compra
            </Button>
            }
        />

        {error && (
            <div className="mb-4">
            <InfoBox tipo="error">
                {error}
            </InfoBox>
            </div>
        )}

        {mensaje && (
            <div className="mb-4">
            <InfoBox tipo="exito">
                {mensaje}
            </InfoBox>
            </div>
        )}

        {/* ========================================================
            MODAL NUEVA ORDEN
        ======================================================== */}

        {mostrarFormulario && (
            <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
            onMouseDown={(e) => {
                if (
                e.target === e.currentTarget
                ) {
                cerrarFormulario();
                }
            }}
            >
            <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-carbon/10 bg-white shadow-xl">

                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-carbon/10 bg-white px-6 py-4">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-carbon/45">
                    PROV-10 · COMPRAS
                    </p>

                    <h2 className="mt-1 text-lg font-semibold">
                    Nueva orden de compra
                    </h2>

                    <p className="mt-1 text-xs text-carbon/55">
                    El número de orden se generará automáticamente.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={
                    cerrarFormulario
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-carbon/40 hover:bg-carbon/5"
                >
                    ×
                </button>
                </div>

                <div className="p-6">

                {/* COMPRADOR / PROVEEDOR */}

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-carbon/10 bg-carbon/[0.025] p-4">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-carbon/45">
                        Comprador
                    </p>

                    <p className="text-sm font-semibold">
                        {COMPRADOR.nombre}
                    </p>

                    <div className="mt-2 space-y-1 text-xs text-carbon/60">
                        <p>
                        <strong>CUIT:</strong>{" "}
                        {COMPRADOR.cuit}
                        </p>

                        <p>
                        <strong>Dirección:</strong>{" "}
                        {COMPRADOR.direccion}
                        </p>
                    </div>
                    </div>

                    <div className="rounded-lg border border-carbon/10 bg-carbon/[0.025] p-4">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-carbon/45">
                        Proveedor
                    </p>

                    {proveedorSeleccionado ? (
                        <>
                        <p className="text-sm font-semibold">
                            {proveedorSeleccionado.supplier_trade_name ??
                            proveedorSeleccionado.supplier_legal_name}
                        </p>

                        <div className="mt-2 space-y-1 text-xs text-carbon/60">
                            <p>
                            <strong>CUIT:</strong>{" "}
                            {
                                proveedorSeleccionado.supplier_cuit
                            }
                            </p>

                            <p>
                            <strong>Dirección:</strong>{" "}
                            {proveedorSeleccionado.supplier_address ||
                                "Sin dirección registrada"}
                            </p>
                        </div>
                        </>
                    ) : (
                        <p className="text-xs text-carbon/45">
                        Seleccioná un proveedor.
                        </p>
                    )}
                    </div>
                </div>

                {/* DATOS ORDEN */}

                <div className="mt-6">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-carbon/45">
                    Datos de la orden
                    </p>

                    <FieldGrid>
                    <Field
                        label="Proveedor"
                        htmlFor="proveedor"
                    >
                        <Select
                        id="proveedor"
                        value={
                            proveedorId
                        }
                        onChange={(e) =>
                            setProveedorId(
                            e.target.value
                            )
                        }
                        >
                        <option value="">
                            Seleccionar proveedor
                        </option>

                        {proveedores.map(
                            (proveedor) => (
                            <option
                                key={
                                proveedor.supplier_id
                                }
                                value={
                                proveedor.supplier_id
                                }
                            >
                                {proveedor.supplier_trade_name ??
                                proveedor.supplier_legal_name}
                            </option>
                            )
                        )}
                        </Select>
                    </Field>

                    <Field
                        label="Fecha de emisión"
                        htmlFor="emision"
                    >
                        <Input
                        id="emision"
                        type="date"
                        value={
                            fechaEmision
                        }
                        onChange={(e) =>
                            setFechaEmision(
                            e.target.value
                            )
                        }
                        />
                    </Field>

                    <Field
                        label="Lugar de emisión"
                        htmlFor="lugar"
                    >
                        <Input
                        id="lugar"
                        value={
                            lugarEmision
                        }
                        onChange={(e) =>
                            setLugarEmision(
                            e.target.value
                            )
                        }
                        />
                    </Field>

                    <Field
                        label="Entrega estimada"
                        htmlFor="entrega"
                    >
                        <Input
                        id="entrega"
                        type="date"
                        min={
                            fechaEmision ||
                            undefined
                        }
                        value={
                            fechaEntrega
                        }
                        onChange={(e) =>
                            setFechaEntrega(
                            e.target.value
                            )
                        }
                        />
                    </Field>
                    </FieldGrid>
                </div>

                {/* CONDICIONES */}

                <div className="mt-6">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-carbon/45">
                    Condiciones
                    </p>

                    <FieldGrid>
                    <Field
                        label="Condición de pago"
                        htmlFor="pago"
                    >
                        <Input
                        id="pago"
                        placeholder="Ej: Transferencia a 30 días"
                        value={
                            condicionPago
                        }
                        onChange={(e) =>
                            setCondicionPago(
                            e.target.value
                            )
                        }
                        />
                    </Field>

                    <Field
                        label="Condición de entrega"
                        htmlFor="condicion-entrega"
                    >
                        <Input
                        id="condicion-entrega"
                        placeholder="Ej: Entrega en el hotel"
                        value={
                            condicionEntrega
                        }
                        onChange={(e) =>
                            setCondicionEntrega(
                            e.target.value
                            )
                        }
                        />
                    </Field>
                    </FieldGrid>
                </div>

                {/* ITEMS */}

                <div className="mt-7 border-t border-carbon/10 pt-5">
                    <div className="mb-3 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold">
                        Productos o servicios
                        </h3>
                    </div>

                    <Button
                        type="button"
                        variante="secundario"
                        onClick={
                        agregarDetalle
                        }
                    >
                        + Agregar ítem
                    </Button>
                    </div>

                    <div className="overflow-x-auto">
                    <Table>
                        <THead>
                        <TH>Artículo</TH>
                        <TH>Descripción</TH>
                        <TH>Cantidad</TH>
                        <TH>Precio unitario</TH>
                        <TH className="text-right">
                            Subtotal
                        </TH>
                        <TH></TH>
                        </THead>

                        <TBody>
                        {detalles.map(
                            (
                            detalle,
                            indice
                            ) => {
                            const subtotal =
                                Number(
                                detalle.quantity
                                ) *
                                Number(
                                detalle.unit_price
                                );

                            return (
                                <TR key={indice}>
                                <TD>
                                    <Select
                                    value={
                                        detalle.article_id ??
                                        ""
                                    }
                                    onChange={(e) =>
                                        seleccionarArticulo(
                                        indice,
                                        e.target.value
                                        )
                                    }
                                    >
                                    <option value="">
                                        Servicio / manual
                                    </option>

                                    {articulos.map(
                                        (
                                        articulo
                                        ) => (
                                        <option
                                            key={
                                            articulo.article_id
                                            }
                                            value={
                                            articulo.article_id
                                            }
                                        >
                                            {
                                            articulo.article_name
                                            }
                                        </option>
                                        )
                                    )}
                                    </Select>
                                </TD>

                                <TD>
                                    <Input
                                    placeholder="Descripción"
                                    value={
                                        detalle.item_description
                                    }
                                    onChange={(e) =>
                                        actualizarDetalle(
                                        indice,
                                        "item_description",
                                        e.target.value
                                        )
                                    }
                                    />
                                </TD>

                                <TD>
                                    <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={
                                        detalle.quantity ===
                                        0
                                        ? ""
                                        : String(
                                            detalle.quantity
                                            )
                                    }
                                    onChange={(e) => {
                                        const limpio =
                                        e.target.value
                                            .replace(
                                            /\D/g,
                                            ""
                                            )
                                            .replace(
                                            /^0+(?=\d)/,
                                            ""
                                            );

                                        actualizarDetalle(
                                        indice,
                                        "quantity",
                                        limpio ===
                                            ""
                                            ? 0
                                            : Number(
                                                limpio
                                            )
                                        );
                                    }}
                                    />
                                </TD>

                                <TD>
                                    <Input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={precioInput(
                                        detalle.unit_price
                                    )}
                                    onChange={(e) => {
                                        const limpio =
                                        e.target.value.replace(
                                            /\D/g,
                                            ""
                                        );

                                        actualizarDetalle(
                                        indice,
                                        "unit_price",
                                        limpio ===
                                            ""
                                            ? 0
                                            : Number(
                                                limpio
                                            )
                                        );
                                    }}
                                    />
                                </TD>

                                <TD className="text-right">
                                    $ {plata(subtotal)}
                                </TD>

                                <TD>
                                    <button
                                    type="button"
                                    onClick={() =>
                                        quitarDetalle(
                                        indice
                                        )
                                    }
                                    className="text-xs text-danger underline"
                                    >
                                    Quitar
                                    </button>
                                </TD>
                                </TR>
                            );
                            }
                        )}
                        </TBody>
                    </Table>
                    </div>

                    <div className="mt-4 flex justify-end">
                    <div className="rounded-lg border border-carbon/10 bg-carbon/[0.025] px-5 py-3">
                        <p className="text-xs text-carbon/50">
                        TOTAL
                        </p>

                        <p className="text-xl font-semibold">
                        $ {plata(total)}
                        </p>
                    </div>
                    </div>
                </div>

                {/* OBSERVACIONES */}

                <div className="mt-5">
                    <Field
                    label="Observaciones"
                    htmlFor="observaciones"
                    >
                    <textarea
                        id="observaciones"
                        rows={2}
                        value={
                        observaciones
                        }
                        onChange={(e) =>
                        setObservaciones(
                            e.target.value
                        )
                        }
                        className="w-full rounded-lg border border-carbon/15 px-3 py-2 text-sm"
                    />
                    </Field>
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-carbon/10 pt-5">
                    <Button
                    variante="secundario"
                    onClick={
                        cerrarFormulario
                    }
                    >
                    Cancelar
                    </Button>

                    <Button
                    variante="secundario"
                    onClick={() =>
                        guardarOrden(false)
                    }
                    >
                    Guardar borrador
                    </Button>

                    <Button
                    onClick={() =>
                        guardarOrden(true)
                    }
                    >
                    {guardando
                        ? "Guardando..."
                        : "Emitir orden"}
                    </Button>
                </div>
                </div>
            </div>
            </div>
        )}

        {/* ========================================================
            MODAL VER DETALLE
        ======================================================== */}

        {(ordenDetalle || cargandoDetalle) && (
            <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4"
            onMouseDown={(e) => {
                if (
                e.target === e.currentTarget
                ) {
                setOrdenDetalle(null);
                }
            }}
            >
            <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-carbon/10 bg-white shadow-xl">
                {cargandoDetalle &&
                !ordenDetalle ? (
                <div className="p-10 text-center text-sm text-carbon/50">
                    Cargando detalle…
                </div>
                ) : (
                ordenDetalle && (
                    <>
                    <div className="sticky top-0 z-10 flex items-start justify-between border-b border-carbon/10 bg-white px-6 py-4">
                        <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon/45">
                            Orden de compra
                        </p>

                        <h2 className="mt-1 text-xl font-semibold">
                            {
                            ordenDetalle.purchase_order_number
                            }
                        </h2>

                        <div className="mt-2">
                            <Badge
                            tono={
                                tonoEstado[
                                ordenDetalle
                                    .purchase_order_status
                                ]
                            }
                            >
                            {
                                ordenDetalle
                                .purchase_order_status
                            }
                            </Badge>
                        </div>
                        </div>

                        <button
                        type="button"
                        onClick={() =>
                            setOrdenDetalle(
                            null
                            )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-carbon/40 hover:bg-carbon/5"
                        >
                        ×
                        </button>
                    </div>

                    <div className="p-6">

                        {/* PROVEEDOR */}

                        <div className="rounded-lg border border-carbon/10 bg-carbon/[0.025] p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon/45">
                            Proveedor
                        </p>

                        <p className="mt-2 font-semibold">
                            {ordenDetalle.suppliers
                            .supplier_trade_name ??
                            ordenDetalle.suppliers
                                .supplier_legal_name}
                        </p>

                        <div className="mt-2 grid gap-2 text-sm text-carbon/60 sm:grid-cols-2">
                            <p>
                            <strong>
                                Razón social:
                            </strong>{" "}
                            {
                                ordenDetalle.suppliers
                                .supplier_legal_name
                            }
                            </p>

                            <p>
                            <strong>
                                CUIT:
                            </strong>{" "}
                            {ordenDetalle.suppliers
                                .supplier_cuit ??
                                "—"}
                            </p>

                            <p>
                            <strong>
                                Dirección:
                            </strong>{" "}
                            {ordenDetalle.suppliers
                                .supplier_address ??
                                "—"}
                            </p>
                        </div>
                        </div>

                        {/* DATOS */}

                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border border-carbon/10 p-3">
                            <p className="text-[10px] uppercase text-carbon/45">
                            Emisión
                            </p>

                            <p className="mt-1 text-sm font-medium">
                            {fecha(
                                ordenDetalle.issue_date
                            )}
                            </p>
                        </div>

                        <div className="rounded-lg border border-carbon/10 p-3">
                            <p className="text-[10px] uppercase text-carbon/45">
                            Entrega estimada
                            </p>

                            <p className="mt-1 text-sm font-medium">
                            {fecha(
                                ordenDetalle.expected_date
                            )}
                            </p>
                        </div>

                        <div className="rounded-lg border border-carbon/10 p-3">
                            <p className="text-[10px] uppercase text-carbon/45">
                            Responsable
                            </p>

                            <p className="mt-1 text-sm font-medium">
                            {ordenDetalle.employees
                                ? `${ordenDetalle.employees.employees_name} ${ordenDetalle.employees.employees_lastname}`
                                : "—"}
                            </p>
                        </div>
                        </div>

                        {/* CONDICIONES */}

                        <div className="mt-5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon/45">
                            Condiciones de compra
                        </p>

                        <p className="mt-2 rounded-lg border border-carbon/10 p-3 text-sm">
                            {ordenDetalle.purchase_conditions ||
                            "Sin condiciones registradas."}
                        </p>
                        </div>

                        {/* PRODUCTOS */}

                        <div className="mt-6">
                        <h3 className="mb-3 text-sm font-semibold">
                            Productos / servicios
                        </h3>

                        <Table>
                            <THead>
                            <TH>
                                Descripción
                            </TH>

                            <TH>
                                Cantidad
                            </TH>

                            <TH>
                                Precio unitario
                            </TH>

                            <TH className="text-right">
                                Subtotal
                            </TH>
                            </THead>

                            <TBody>
                            {ordenDetalle
                                .purchase_order_detail
                                .map(
                                (
                                    detalle
                                ) => {
                                    const subtotal =
                                    Number(
                                        detalle.quantity
                                    ) *
                                    Number(
                                        detalle.unit_price
                                    );

                                    return (
                                    <TR
                                        key={
                                        detalle.purchase_detail_id
                                        }
                                    >
                                        <TD>
                                        {
                                            detalle.item_description
                                        }
                                        </TD>

                                        <TD>
                                        {
                                            detalle.quantity
                                        }
                                        </TD>

                                        <TD>
                                        ${" "}
                                        {plata(
                                            detalle.unit_price
                                        )}
                                        </TD>

                                        <TD className="text-right font-medium">
                                        ${" "}
                                        {plata(
                                            subtotal
                                        )}
                                        </TD>
                                    </TR>
                                    );
                                }
                                )}
                            </TBody>
                        </Table>

                        <div className="mt-4 flex justify-end">
                            <div className="rounded-lg bg-carbon/[0.04] px-5 py-3">
                            <p className="text-xs uppercase text-carbon/45">
                                Total de la orden
                            </p>

                            <p className="mt-1 text-xl font-semibold">
                                ${" "}
                                {plata(
                                ordenDetalle.total_amount
                                )}
                            </p>
                            </div>
                        </div>
                        </div>

                        {/* OBSERVACIONES */}

                        {ordenDetalle.observations && (
                        <div className="mt-5">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon/45">
                            Observaciones
                            </p>

                            <p className="mt-2 text-sm">
                            {
                                ordenDetalle.observations
                            }
                            </p>
                        </div>
                        )}

                        <div className="mt-6 flex justify-end">
                        <Button
                            variante="secundario"
                            onClick={() =>
                            setOrdenDetalle(
                                null
                            )
                            }
                        >
                            Cerrar
                        </Button>
                        </div>
                    </div>
                    </>
                )
                )}
            </div>
            </div>
        )}

        {/* ========================================================
            LISTADO
        ======================================================== */}

        <Card>
            <div className="mb-5">
            <FieldGrid>
                <Field
                label="Proveedor"
                htmlFor="filtroProveedor"
                >
                <Select
                    id="filtroProveedor"
                    value={
                    filtroProveedor
                    }
                    onChange={(e) =>
                    setFiltroProveedor(
                        e.target.value
                    )
                    }
                >
                    <option value="">
                    Todos
                    </option>

                    {proveedores.map(
                    (proveedor) => (
                        <option
                        key={
                            proveedor.supplier_id
                        }
                        value={
                            proveedor.supplier_id
                        }
                        >
                        {proveedor.supplier_trade_name ??
                            proveedor.supplier_legal_name}
                        </option>
                    )
                    )}
                </Select>
                </Field>

                <Field
                label="Estado"
                htmlFor="filtroEstado"
                >
                <Select
                    id="filtroEstado"
                    value={
                    filtroEstado
                    }
                    onChange={(e) =>
                    setFiltroEstado(
                        e.target.value
                    )
                    }
                >
                    <option value="">
                    Todos
                    </option>

                    <option value="BORRADOR">
                    Borrador
                    </option>

                    <option value="EMITIDA">
                    Emitida
                    </option>

                    <option value="APROBADA">
                    Aprobada
                    </option>

                    <option value="RECIBIDA">
                    Recibida
                    </option>

                    <option value="CANCELADA">
                    Cancelada
                    </option>
                </Select>
                </Field>
            </FieldGrid>
            </div>

            {cargando ? (
            <p className="py-10 text-center text-sm text-carbon/50">
                Cargando órdenes…
            </p>
            ) : ordenes.length === 0 ? (
            <EmptyState
                titulo="No hay órdenes de compra"
                descripcion="Creá una orden para comenzar a registrar las compras del hotel."
                accion={
                <Button
                    onClick={
                    abrirFormulario
                    }
                >
                    Nueva orden
                </Button>
                }
            />
            ) : (
            <Table>
                <THead>
                <TH>Orden</TH>
                <TH>Proveedor</TH>
                <TH>Emisión</TH>
                <TH>Entrega</TH>
                <TH>Ítems</TH>
                <TH className="text-right">
                    Total
                </TH>
                <TH>Estado</TH>
                <TH>Acciones</TH>
                </THead>

                <TBody>
                {ordenes.map(
                    (orden) => (
                    <TR
                        key={
                        orden.purchase_order_id
                        }
                    >
                        <TD>
                        <button
                            type="button"
                            className="font-mono text-xs font-medium underline decoration-carbon/30 underline-offset-4 hover:decoration-carbon"
                            onClick={() =>
                            verDetalle(
                                orden.purchase_order_id
                            )
                            }
                        >
                            {
                            orden.purchase_order_number
                            }
                        </button>
                        </TD>

                        <TD>
                        {orden.suppliers
                            .supplier_trade_name ??
                            orden.suppliers
                            .supplier_legal_name}
                        </TD>

                        <TD>
                        {fecha(
                            orden.issue_date
                        )}
                        </TD>

                        <TD>
                        {fecha(
                            orden.expected_date
                        )}
                        </TD>

                        <TD>
                        {orden._count
                            ?.purchase_order_detail ??
                            orden
                            .purchase_order_detail
                            .length}
                        </TD>

                        <TD className="text-right">
                        ${" "}
                        {plata(
                            orden.total_amount
                        )}
                        </TD>

                        <TD>
                        <Badge
                            tono={
                            tonoEstado[
                                orden.purchase_order_status
                            ]
                            }
                        >
                            {
                            orden.purchase_order_status
                            }
                        </Badge>
                        </TD>

                        <TD>
                        <div className="flex flex-wrap gap-2">
                            <button
                            type="button"
                            className="text-xs font-medium underline"
                            onClick={() =>
                                verDetalle(
                                orden.purchase_order_id
                                )
                            }
                            >
                            Ver detalle
                            </button>

                            {orden.purchase_order_status ===
                            "BORRADOR" && (
                            <>
                                <button
                                type="button"
                                className="text-xs font-medium underline"
                                onClick={() =>
                                    cambiarEstado(
                                    orden,
                                    "EMITIDA"
                                    )
                                }
                                >
                                Emitir
                                </button>

                                <button
                                type="button"
                                className="text-xs font-medium text-danger underline"
                                onClick={() =>
                                    cambiarEstado(
                                    orden,
                                    "CANCELADA"
                                    )
                                }
                                >
                                Cancelar
                                </button>
                            </>
                            )}

                            {orden.purchase_order_status ===
                            "EMITIDA" && (
                            <>
                                <button
                                type="button"
                                className="text-xs font-medium underline"
                                onClick={() =>
                                    cambiarEstado(
                                    orden,
                                    "APROBADA"
                                    )
                                }
                                >
                                Aprobar
                                </button>

                                <button
                                type="button"
                                className="text-xs font-medium text-danger underline"
                                onClick={() =>
                                    cambiarEstado(
                                    orden,
                                    "CANCELADA"
                                    )
                                }
                                >
                                Cancelar
                                </button>
                            </>
                            )}

                            {orden.purchase_order_status ===
                            "APROBADA" && (
                            <>
                                <button
                                type="button"
                                className="text-xs font-medium underline"
                                onClick={() =>
                                    cambiarEstado(
                                    orden,
                                    "RECIBIDA"
                                    )
                                }
                                >
                                Marcar recibida
                                </button>

                                <button
                                type="button"
                                className="text-xs font-medium text-danger underline"
                                onClick={() =>
                                    cambiarEstado(
                                    orden,
                                    "CANCELADA"
                                    )
                                }
                                >
                                Cancelar
                                </button>
                            </>
                            )}

                            {(orden.purchase_order_status ===
                            "RECIBIDA" ||
                            orden.purchase_order_status ===
                                "CANCELADA") && (
                            <span className="text-xs text-carbon/40">
                                Finalizada
                            </span>
                            )}
                        </div>
                        </TD>
                    </TR>
                    )
                )}
                </TBody>
            </Table>
            )}
        </Card>
        </>
    );
    }