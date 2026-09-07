    "use client";

    import { useCallback, useEffect, useMemo, useState } from "react";

    import { PageHeader } from "@/components/layout/PageHeader";

    import {
    Badge,
    Button,
    Card,
    EmptyState,
    InfoBox,
    Input,
    Table,
    THead,
    TH,
    TBody,
    TR,
    TD,
    } from "@/components/ui";

    import { api, ApiError } from "@/lib/api";
    import type { Comprobante } from "@/lib/types";

    type Proveedor = {
    supplier_id: number;
    supplier_legal_name: string;
    supplier_trade_name: string | null;
    supplier_cuit: string;
    };

    type MetodoPago = {
    payment_method_id: number;
    payment_method: string;
    description: string;
    requires_reference: boolean;
    active: boolean;
    };

    type CuentaCorriente = {
    saldo: {
        current_balance: string | number;
        total_debit: string | number;
        total_credit: string | number;
    };
    movimientos: {
        account_movement_id: number;
        movement_date: string;
        concept: string;
        debit: string | number;
        credit: string | number;
    }[];
    };

    type OrdenCreada = {
    payment_order_id: number;
    };

    type OrdenPago = {
    payment_order_id: number;
    payment_order_status: number;
    payment_date: string;
    total_amount: string | number;
    payment_reference: string | null;

    suppliers: {
        supplier_legal_name: string;
        supplier_trade_name: string | null;
    };

    payment_method: {
        payment_method: string;
    };
    };

    const plata = (valor: string | number) =>
    Number(valor).toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    const fechaHoy = () => new Date().toISOString().slice(0, 10);

    export default function PagosProveedoresPage() {
    const [proveedores, setProveedores] = useState<Proveedor[]>([]);
    const [metodos, setMetodos] = useState<MetodoPago[]>([]);
    const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
    const [ordenes, setOrdenes] = useState<OrdenPago[]>([]);

    const [proveedorId, setProveedorId] = useState("");
    const [metodoId, setMetodoId] = useState("");
    const [fechaPago, setFechaPago] = useState(fechaHoy());
    const [referencia, setReferencia] = useState("");
    const [observaciones, setObservaciones] = useState("");

    const [cuenta, setCuenta] = useState<CuentaCorriente | null>(null);

    const [seleccionados, setSeleccionados] = useState<
        Record<number, string>
    >({});

    const [motivoReset, setMotivoReset] = useState("");
    const [ordenResetId, setOrdenResetId] = useState<number | null>(null);

    const [cargando, setCargando] = useState(true);
    const [cargandoProveedor, setCargandoProveedor] = useState(false);
    const [guardando, setGuardando] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [exito, setExito] = useState<string | null>(null);

    // ============================================================
    // CARGA INICIAL
    // ============================================================

    const cargarInicial = useCallback(async () => {
        setCargando(true);
        setError(null);

        try {
        const [listaProveedores, listaMetodos, listaOrdenes] =
            await Promise.all([
            api.get<Proveedor[]>("/proveedores?activos=true"),
            api.get<MetodoPago[]>("/ordenes-pago/metodos"),
            api.get<OrdenPago[]>("/ordenes-pago"),
            ]);

        setProveedores(listaProveedores);
        setMetodos(listaMetodos);
        setOrdenes(listaOrdenes);
        } catch (err) {
        setError(
            err instanceof ApiError
            ? err.message
            : "No se pudieron cargar los datos necesarios."
        );
        } finally {
        setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargarInicial();
    }, [cargarInicial]);

    // ============================================================
    // CARGAR CUENTA Y COMPROBANTES DEL PROVEEDOR
    // ============================================================

    useEffect(() => {
        if (!proveedorId) {
        setCuenta(null);
        setComprobantes([]);
        setSeleccionados({});
        return;
        }

        const cargarProveedor = async () => {
        setCargandoProveedor(true);
        setError(null);
        setExito(null);
        setSeleccionados({});

        try {
            const [datosCuenta, listaComprobantes] = await Promise.all([
            api.get<CuentaCorriente>(
                `/ordenes-pago/cuenta-corriente/${proveedorId}`
            ),
            api.get<Comprobante[]>(
                `/comprobantes?supplier_id=${proveedorId}&payable=true`
            ),
            ]);

            setCuenta(datosCuenta);

            setComprobantes(
            listaComprobantes.filter(
                (comprobante) =>
                comprobante.voucher_status === "PENDIENTE" &&
                Number(comprobante.pending_amount) > 0
            )
            );
        } catch (err) {
            setError(
            err instanceof ApiError
                ? err.message
                : "No se pudo cargar la cuenta corriente del proveedor."
            );
        } finally {
            setCargandoProveedor(false);
        }
        };

        cargarProveedor();
    }, [proveedorId]);

    // ============================================================
    // DATOS DERIVADOS
    // ============================================================

    const proveedorSeleccionado = proveedores.find(
        (proveedor) => proveedor.supplier_id === Number(proveedorId)
    );

    const metodoSeleccionado = metodos.find(
        (metodo) => metodo.payment_method_id === Number(metodoId)
    );

    const totalPago = useMemo(
        () =>
        Object.values(seleccionados).reduce(
            (total, valor) => total + (Number(valor) || 0),
            0
        ),
        [seleccionados]
    );

    // ============================================================
    // SELECCIÓN DE COMPROBANTES
    // ============================================================

    const cambiarSeleccion = (comprobante: Comprobante) => {
        setSeleccionados((actual) => {
        const copia = { ...actual };

        if (copia[comprobante.voucher_id] !== undefined) {
            delete copia[comprobante.voucher_id];
        } else {
            copia[comprobante.voucher_id] = String(
            comprobante.pending_amount
            );
        }

        return copia;
        });
    };

    const cambiarImporte = (voucherId: number, valor: string) => {
        setSeleccionados((actual) => ({
        ...actual,
        [voucherId]: valor,
        }));
    };

    // ============================================================
    // REGISTRAR Y CONFIRMAR PAGO
    // ============================================================

    const registrarPago = async () => {
        setError(null);
        setExito(null);

        if (!proveedorId) {
        setError("Elegí un proveedor.");
        return;
        }

        if (!metodoId) {
        setError("Elegí una forma de pago.");
        return;
        }

        if (!fechaPago) {
        setError("Ingresá la fecha de pago.");
        return;
        }

        const detalles = Object.entries(seleccionados)
        .map(([voucherId, importe]) => ({
            voucher_id: Number(voucherId),
            applied_amount: Number(importe),
        }))
        .filter((detalle) => detalle.applied_amount > 0);

        if (detalles.length === 0) {
        setError("Seleccioná al menos un comprobante para pagar.");
        return;
        }

        for (const detalle of detalles) {
        const comprobante = comprobantes.find(
            (item) => item.voucher_id === detalle.voucher_id
        );

        if (
            comprobante &&
            detalle.applied_amount > Number(comprobante.pending_amount)
        ) {
            setError(
            `El importe aplicado a ${comprobante.voucher_full_number} supera su saldo pendiente.`
            );
            return;
        }
        }

        if (
        metodoSeleccionado?.requires_reference &&
        !referencia.trim()
        ) {
        setError(
            `${metodoSeleccionado.payment_method.replaceAll(
            "_",
            " "
            )} requiere una referencia.`
        );
        return;
        }

        setGuardando(true);

        try {
        const orden = await api.post<OrdenCreada>("/ordenes-pago", {
            supplier_id: Number(proveedorId),
            payment_method_id: Number(metodoId),
            payment_date: fechaPago,
            payment_reference: referencia.trim() || null,
            observations: observaciones.trim() || null,
        });

        for (const detalle of detalles) {
            await api.post(
            `/ordenes-pago/${orden.payment_order_id}/detalles`,
            detalle
            );
        }

        await api.post(
            `/ordenes-pago/${orden.payment_order_id}/confirmar`,
            {}
        );

        setExito(
            `Pago registrado correctamente. Orden #${orden.payment_order_id}.`
        );

        setMetodoId("");
        setReferencia("");
        setObservaciones("");
        setSeleccionados({});

        const [datosCuenta, listaComprobantes, listaOrdenes] =
            await Promise.all([
            api.get<CuentaCorriente>(
                `/ordenes-pago/cuenta-corriente/${proveedorId}`
            ),
            api.get<Comprobante[]>(
                `/comprobantes?supplier_id=${proveedorId}&payable=true`
            ),
            api.get<OrdenPago[]>("/ordenes-pago"),
            ]);

        setCuenta(datosCuenta);

        setComprobantes(
            listaComprobantes.filter(
            (comprobante) =>
                comprobante.voucher_status === "PENDIENTE" &&
                Number(comprobante.pending_amount) > 0
            )
        );

        setOrdenes(listaOrdenes);
        } catch (err) {
        setError(
            err instanceof ApiError
            ? err.message
            : "No se pudo registrar el pago."
        );
        } finally {
        setGuardando(false);
        }
    };

    // ============================================================
    // RESETEAR ORDEN
    // ============================================================

    const resetearOrden = async (id: number) => {
        if (!motivoReset.trim()) {
        setError("Ingresá el motivo del reseteo.");
        return;
        }

        setError(null);
        setExito(null);

        try {
        await api.post(`/ordenes-pago/${id}/resetear`, {
            reset_reason: motivoReset,
        });

        setExito(`La orden #${id} volvió a estado borrador.`);
        setMotivoReset("");
        setOrdenResetId(null);

        const listaOrdenes = await api.get<OrdenPago[]>(
            "/ordenes-pago"
        );

        setOrdenes(listaOrdenes);

        if (proveedorId) {
            const [datosCuenta, listaComprobantes] = await Promise.all([
            api.get<CuentaCorriente>(
                `/ordenes-pago/cuenta-corriente/${proveedorId}`
            ),
            api.get<Comprobante[]>(
                `/comprobantes?supplier_id=${proveedorId}&payable=true`
            ),
            ]);

            setCuenta(datosCuenta);

            setComprobantes(
            listaComprobantes.filter(
                (comprobante) =>
                comprobante.voucher_status === "PENDIENTE" &&
                Number(comprobante.pending_amount) > 0
            )
            );
        }
        } catch (err) {
        setError(
            err instanceof ApiError
            ? err.message
            : "No se pudo resetear la orden."
        );
        }
    };

    // ============================================================
    // PANTALLA
    // ============================================================

    return (
        <>
        <PageHeader
            eyebrow="Tesorería"
            titulo="Registrar pago a proveedor"
            descripcion="Registrá el pago de comprobantes y mantené actualizada la cuenta corriente del proveedor."
        />

        {error && (
            <div className="mb-5">
            <InfoBox tipo="error">{error}</InfoBox>
            </div>
        )}

        {exito && (
            <div className="mb-5">
            <InfoBox tipo="exito">{exito}</InfoBox>
            </div>
        )}

        <Card>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-carbon/70">
            Proveedor
            </h2>

            {cargando ? (
            <p className="py-6 text-sm text-carbon/50">
                Cargando proveedores…
            </p>
            ) : (
            <div className="grid gap-4 md:grid-cols-2">
                <div>
                <label className="mb-1 block text-xs font-medium text-carbon/70">
                    Proveedor
                </label>

                <select
                    value={proveedorId}
                    onChange={(e) => setProveedorId(e.target.value)}
                    className="h-10 w-full rounded-md border border-carbon/20 bg-white px-3 text-sm outline-none focus:border-gold"
                >
                    <option value="">Seleccionar proveedor</option>

                    {proveedores.map((proveedor) => (
                    <option
                        key={proveedor.supplier_id}
                        value={proveedor.supplier_id}
                    >
                        {proveedor.supplier_trade_name ??
                        proveedor.supplier_legal_name}
                    </option>
                    ))}
                </select>
                </div>

                {proveedorSeleccionado && (
                <div className="rounded-md bg-bone px-4 py-3 text-xs text-carbon/70">
                    <p className="font-semibold text-carbon">
                    {proveedorSeleccionado.supplier_legal_name}
                    </p>
                    <p>CUIT: {proveedorSeleccionado.supplier_cuit}</p>
                </div>
                )}
            </div>
            )}
        </Card>

        {proveedorId && (
            <>
            <div className="mt-5 grid gap-5 md:grid-cols-3">
                <Card>
                <p className="text-xs uppercase tracking-wide text-carbon/50">
                    Saldo actual
                </p>

                <p className="mt-2 text-2xl font-semibold tabular-nums text-carbon">
                    $ {plata(cuenta?.saldo.current_balance ?? 0)}
                </p>
                </Card>

                <Card>
                <p className="text-xs uppercase tracking-wide text-carbon/50">
                    Total facturado
                </p>

                <p className="mt-2 text-2xl font-semibold tabular-nums text-carbon">
                    $ {plata(cuenta?.saldo.total_debit ?? 0)}
                </p>
                </Card>

                <Card>
                <p className="text-xs uppercase tracking-wide text-carbon/50">
                    Total pagado
                </p>

                <p className="mt-2 text-2xl font-semibold tabular-nums text-carbon">
                    $ {plata(cuenta?.saldo.total_credit ?? 0)}
                </p>
                </Card>
            </div>

            <div className="mt-5">
                <Card>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-carbon/70">
                    Comprobantes pendientes
                </h2>

                {cargandoProveedor ? (
                    <p className="py-8 text-center text-sm text-carbon/50">
                    Cargando cuenta corriente…
                    </p>
                ) : comprobantes.length === 0 ? (
                    <EmptyState
                    titulo="El proveedor no tiene comprobantes pendientes"
                    descripcion="No hay deuda disponible para registrar un pago."
                    />
                ) : (
                    <Table>
                    <THead>
                        <TH></TH>
                        <TH>Comprobante</TH>
                        <TH>Vencimiento</TH>
                        <TH className="text-right">Pendiente</TH>
                        <TH className="text-right">
                        Importe a pagar
                        </TH>
                    </THead>

                    <TBody>
                        {comprobantes.map((comprobante) => {
                        const seleccionado =
                            seleccionados[comprobante.voucher_id] !==
                            undefined;

                        return (
                            <TR key={comprobante.voucher_id}>
                            <TD>
                                <input
                                type="checkbox"
                                checked={seleccionado}
                                onChange={() =>
                                    cambiarSeleccion(comprobante)
                                }
                                />
                            </TD>

                            <TD>
                                <span className="font-medium">
                                {comprobante.voucher_type.replaceAll(
                                    "_",
                                    " "
                                )}
                                </span>

                                <span className="block font-mono text-xs text-carbon/50">
                                {comprobante.voucher_full_number}
                                </span>
                            </TD>

                            <TD className="text-xs">
                                {comprobante.due_date
                                ? new Date(
                                    comprobante.due_date
                                    ).toLocaleDateString("es-AR")
                                : "—"}

                                {comprobante.is_overdue && (
                                <span className="ml-2">
                                    <Badge tono="alerta">
                                    VENCIDO
                                    </Badge>
                                </span>
                                )}
                            </TD>

                            <TD className="text-right tabular-nums">
                                $ {plata(comprobante.pending_amount)}
                            </TD>

                            <TD className="text-right">
                                {seleccionado ? (
                                <Input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    max={Number(
                                    comprobante.pending_amount
                                    )}
                                    value={
                                    seleccionados[
                                        comprobante.voucher_id
                                    ]
                                    }
                                    onChange={(e) =>
                                    cambiarImporte(
                                        comprobante.voucher_id,
                                        e.target.value
                                    )
                                    }
                                    className="ml-auto max-w-32 text-right"
                                />
                                ) : (
                                "—"
                                )}
                            </TD>
                            </TR>
                        );
                        })}
                    </TBody>
                    </Table>
                )}
                </Card>
            </div>

            <div className="mt-5">
                <Card>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-carbon/70">
                    Datos del pago
                </h2>

                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                    <label className="mb-1 block text-xs font-medium text-carbon/70">
                        Forma de pago
                    </label>

                    <select
                        value={metodoId}
                        onChange={(e) => {
                        setMetodoId(e.target.value);
                        setReferencia("");
                        }}
                        className="h-10 w-full rounded-md border border-carbon/20 bg-white px-3 text-sm outline-none focus:border-gold"
                    >
                        <option value="">Seleccionar</option>

                        {metodos.map((metodo) => (
                        <option
                            key={metodo.payment_method_id}
                            value={metodo.payment_method_id}
                        >
                            {metodo.payment_method.replaceAll(
                            "_",
                            " "
                            )}
                        </option>
                        ))}
                    </select>
                    </div>

                    <div>
                    <label className="mb-1 block text-xs font-medium text-carbon/70">
                        Fecha de pago
                    </label>

                    <Input
                        type="date"
                        value={fechaPago}
                        onChange={(e) => setFechaPago(e.target.value)}
                    />
                    </div>

                    {metodoSeleccionado?.requires_reference && (
                    <div>
                        <label className="mb-1 block text-xs font-medium text-carbon/70">
                        {metodoSeleccionado.payment_method ===
                        "CHEQUE"
                            ? "Número de cheque"
                            : "Número de operación"}
                        </label>

                        <Input
                        value={referencia}
                        onChange={(e) =>
                            setReferencia(e.target.value)
                        }
                        placeholder={
                            metodoSeleccionado.payment_method ===
                            "CHEQUE"
                            ? "Ej. 00012345"
                            : "Ej. TRX-458239"
                        }
                        />
                    </div>
                    )}

                    <div
                    className={
                        metodoSeleccionado?.requires_reference
                        ? ""
                        : "md:col-span-2"
                    }
                    >
                    <label className="mb-1 block text-xs font-medium text-carbon/70">
                        Observaciones
                    </label>

                    <textarea
                        value={observaciones}
                        onChange={(e) =>
                        setObservaciones(e.target.value)
                        }
                        rows={3}
                        className="w-full rounded-md border border-carbon/20 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
                        placeholder="Observaciones opcionales"
                    />
                    </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-carbon/10 pt-5">
                    <div>
                    <p className="text-xs uppercase tracking-wide text-carbon/50">
                        Total del pago
                    </p>

                    <p className="text-2xl font-semibold tabular-nums text-carbon">
                        $ {plata(totalPago)}
                    </p>
                    </div>

                    <Button
                    onClick={registrarPago}
                    disabled={guardando || totalPago <= 0}
                    >
                    {guardando
                        ? "Registrando…"
                        : "Registrar y confirmar pago"}
                    </Button>
                </div>
                </Card>
            </div>

            {cuenta && cuenta.movimientos.length > 0 && (
                <div className="mt-5">
                <Card>
                    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-carbon/70">
                    Últimos movimientos de cuenta corriente
                    </h2>

                    <Table>
                    <THead>
                        <TH>Fecha</TH>
                        <TH>Concepto</TH>
                        <TH className="text-right">Debe</TH>
                        <TH className="text-right">Haber</TH>
                    </THead>

                    <TBody>
                        {cuenta.movimientos
                        .slice(0, 10)
                        .map((movimiento) => (
                            <TR
                            key={movimiento.account_movement_id}
                            >
                            <TD className="text-xs">
                                {new Date(
                                movimiento.movement_date
                                ).toLocaleDateString("es-AR")}
                            </TD>

                            <TD>{movimiento.concept}</TD>

                            <TD className="text-right tabular-nums">
                                {Number(movimiento.debit) > 0
                                ? `$ ${plata(movimiento.debit)}`
                                : "—"}
                            </TD>

                            <TD className="text-right tabular-nums">
                                {Number(movimiento.credit) > 0
                                ? `$ ${plata(movimiento.credit)}`
                                : "—"}
                            </TD>
                            </TR>
                        ))}
                    </TBody>
                    </Table>
                </Card>
                </div>
            )}
            </>
        )}

        <div className="mt-5">
            <Card>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-carbon/70">
                Órdenes de pago recientes
            </h2>

            {ordenes.length === 0 ? (
                <EmptyState
                titulo="No hay órdenes de pago"
                descripcion="Las órdenes registradas aparecerán acá."
                />
            ) : (
                <Table>
                <THead>
                    <TH>Orden</TH>
                    <TH>Proveedor</TH>
                    <TH>Fecha</TH>
                    <TH>Medio</TH>
                    <TH className="text-right">Total</TH>
                    <TH>Estado</TH>
                    <TH>Acción</TH>
                </THead>

                <TBody>
                    {ordenes.slice(0, 10).map((orden) => (
                    <TR key={orden.payment_order_id}>
                        <TD>#{orden.payment_order_id}</TD>

                        <TD>
                        {orden.suppliers.supplier_trade_name ??
                            orden.suppliers.supplier_legal_name}
                        </TD>

                        <TD>
                        {new Date(
                            orden.payment_date
                        ).toLocaleDateString("es-AR")}
                        </TD>

                        <TD>
                        {orden.payment_method.payment_method.replaceAll(
                            "_",
                            " "
                        )}
                        </TD>

                        <TD className="text-right tabular-nums">
                        $ {plata(orden.total_amount)}
                        </TD>

                        <TD>
                        <Badge
                            tono={
                            orden.payment_order_status === 1
                                ? "activo"
                                : orden.payment_order_status === 2
                                ? "inactivo"
                                : "alerta"
                            }
                        >
                            {orden.payment_order_status === 1
                            ? "CONFIRMADA"
                            : orden.payment_order_status === 2
                            ? "ANULADA"
                            : "BORRADOR"}
                        </Badge>
                        </TD>

                        <TD>
                        {orden.payment_order_status === 1 ? (
                            ordenResetId ===
                            orden.payment_order_id ? (
                            <div className="flex flex-wrap gap-2">
                                <Input
                                value={motivoReset}
                                onChange={(e) =>
                                    setMotivoReset(e.target.value)
                                }
                                placeholder="Motivo"
                                className="max-w-40"
                                />

                                <Button
                                onClick={() =>
                                    resetearOrden(
                                    orden.payment_order_id
                                    )
                                }
                                >
                                Confirmar
                                </Button>

                                <Button
                                onClick={() => {
                                    setOrdenResetId(null);
                                    setMotivoReset("");
                                }}
                                >
                                Cancelar
                                </Button>
                            </div>
                            ) : (
                            <Button
                                onClick={() => {
                                setOrdenResetId(
                                    orden.payment_order_id
                                );
                                setMotivoReset("");
                                }}
                            >
                                Resetear
                            </Button>
                            )
                        ) : (
                            "—"
                        )}
                        </TD>
                    </TR>
                    ))}
                </TBody>
                </Table>
            )}
            </Card>
        </div>
        </>
    );
    }