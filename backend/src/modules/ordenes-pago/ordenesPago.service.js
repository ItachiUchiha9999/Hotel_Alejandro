    const prisma = require('../../db/prisma');
    const env = require('../../config/env');

    const { noEncontrado, conflicto, invalido } = require('../../utils/AppError');
    const { toId, toPositive, toText } = require('../../utils/parse');

    const toDate = (valor) => {
    const texto = toText(valor);
    if (!texto) return null;

    const fecha = new Date(`${texto}T00:00:00`);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
    };

    // ============================================================
    // MÉTODOS DE PAGO
    // ============================================================

    const listarMetodosPago = async () => {
    return prisma.payment_method.findMany({
        where: { active: true },
        orderBy: { payment_method: 'asc' },
    });
    };

    // ============================================================
    // ÓRDENES DE PAGO
    // ============================================================

    const listar = async ({ supplierId } = {}) => {
    const id = toId(supplierId);

    return prisma.payment_order.findMany({
        where: id ? { supplier_id: id } : undefined,
        include: {
        suppliers: {
            select: {
            supplier_id: true,
            supplier_legal_name: true,
            supplier_trade_name: true,
            supplier_cuit: true,
            },
        },
        payment_method: true,
        employees: {
            select: {
            employees_id: true,
            employees_name: true,
            employees_lastname: true,
            },
        },
        payment_order_detail: {
            include: {
            supplier_voucher: {
                include: {
                voucher_type: true,
                },
            },
            },
        },
        },
        orderBy: {
        payment_order_id: 'desc',
        },
    });
    };

    const obtener = async (id) => {
    const paymentOrderId = toId(id);

    if (!paymentOrderId) {
        throw invalido('El identificador de la orden de pago no es válido.');
    }

    const orden = await prisma.payment_order.findUnique({
        where: {
        payment_order_id: paymentOrderId,
        },
        include: {
        suppliers: true,
        payment_method: true,
        employees: true,
        payment_order_detail: {
            include: {
            supplier_voucher: {
                include: {
                voucher_type: true,
                },
            },
            },
        },
        payment_order_reset: {
            include: {
            employees: {
                select: {
                employees_name: true,
                employees_lastname: true,
                },
            },
            },
            orderBy: {
            reset_date: 'desc',
            },
        },
        },
    });

    if (!orden) {
        throw noEncontrado('La orden de pago no existe.');
    }

    return orden;
    };

    // ============================================================
    // CUENTA CORRIENTE
    // ============================================================

    const obtenerCuentaCorriente = async (supplierId) => {
    const id = toId(supplierId);

    if (!id) {
        throw invalido('El proveedor no es válido.');
    }

    const proveedor = await prisma.suppliers.findUnique({
        where: {
        supplier_id: id,
        },
    });

    if (!proveedor) {
        throw noEncontrado('El proveedor no existe.');
    }

    const [saldo] = await prisma.$queryRaw`
        SELECT *
        FROM v_supplier_account_balance
        WHERE supplier_id = ${id}
    `;

    const movimientos = await prisma.supplier_account_movement.findMany({
        where: {
        supplier_id: id,
        },
        orderBy: {
        movement_date: 'desc',
        },
        take: 50,
    });

    return {
        proveedor,
        saldo: saldo || {
        supplier_id: id,
        total_debit: 0,
        total_credit: 0,
        current_balance: 0,
        last_movement_date: null,
        },
        movimientos,
    };
    };

    // ============================================================
    // CREAR ORDEN EN BORRADOR
    // ============================================================

    const crear = async (payload = {}) => {
    const supplierId = toId(payload.supplier_id);
    const paymentMethodId = toId(payload.payment_method_id);
    const paymentDate = toDate(payload.payment_date);
    const employeeId = toId(payload.employees_id) || env.DEFAULT_EMPLOYEE_ID;

    if (!supplierId) {
        throw invalido('Elegí el proveedor.');
    }

    if (!paymentMethodId) {
        throw invalido('Elegí la forma de pago.');
    }

    if (!paymentDate) {
        throw invalido('Ingresá una fecha de pago válida.');
    }

    const proveedor = await prisma.suppliers.findUnique({
        where: {
        supplier_id: supplierId,
        },
    });

    if (!proveedor) {
        throw noEncontrado('El proveedor no existe.');
    }

    if (!proveedor.supplier_state) {
        throw conflicto('El proveedor está inactivo.');
    }

    const metodo = await prisma.payment_method.findUnique({
        where: {
        payment_method_id: paymentMethodId,
        },
    });

    if (!metodo || !metodo.active) {
        throw invalido('La forma de pago no es válida.');
    }

    const empleado = await prisma.employees.findUnique({
        where: {
        employees_id: employeeId,
        },
    });

    if (!empleado) {
        throw invalido('No se pudo identificar al empleado.');
    }

    return prisma.payment_order.create({
        data: {
        supplier_id: supplierId,
        payment_method_id: paymentMethodId,
        payment_date: paymentDate,
        payment_reference: toText(payload.payment_reference),
        observations: toText(payload.observations),
        employees_id: employeeId,
        },
    });
    };

    // ============================================================
    // AGREGAR COMPROBANTE A LA ORDEN
    // ============================================================

    const agregarDetalle = async (paymentOrderId, payload = {}) => {
    const orderId = toId(paymentOrderId);
    const voucherId = toId(payload.voucher_id);
    const appliedAmount = toPositive(payload.applied_amount);

    if (!orderId) {
        throw invalido('La orden de pago no es válida.');
    }

    if (!voucherId) {
        throw invalido('Elegí el comprobante.');
    }

    if (!appliedAmount) {
        throw invalido('El importe aplicado debe ser mayor a cero.');
    }

    const orden = await prisma.payment_order.findUnique({
        where: {
        payment_order_id: orderId,
        },
    });

    if (!orden) {
        throw noEncontrado('La orden de pago no existe.');
    }

    if (orden.payment_order_status !== 0) {
        throw conflicto('Solo se pueden modificar órdenes en borrador.');
    }

    return prisma.payment_order_detail.create({
        data: {
        payment_order_id: orderId,
        voucher_id: voucherId,
        applied_amount: appliedAmount,
        },
    });
    };

    // ============================================================
    // CONFIRMAR PAGO
    // ============================================================

    const confirmar = async (id) => {
    const paymentOrderId = toId(id);

    if (!paymentOrderId) {
        throw invalido('La orden de pago no es válida.');
    }

    return prisma.$transaction(async (tx) => {
        const orden = await tx.payment_order.findUnique({
        where: {
            payment_order_id: paymentOrderId,
        },
        include: {
            payment_method: true,
            payment_order_detail: true,
        },
        });

        if (!orden) {
        throw noEncontrado('La orden de pago no existe.');
        }

        if (orden.payment_order_status !== 0) {
        throw conflicto('Solo se puede confirmar una orden en borrador.');
        }

        if (orden.payment_order_detail.length === 0) {
        throw invalido('La orden de pago no tiene comprobantes asociados.');
        }

        if (
        orden.payment_method.requires_reference &&
        !toText(orden.payment_reference)
        ) {
        throw invalido(
            `La forma de pago ${orden.payment_method.payment_method} requiere una referencia.`
        );
        }

        for (const detalle of orden.payment_order_detail) {
        const comprobante = await tx.supplier_voucher.findUnique({
            where: {
            voucher_id: detalle.voucher_id,
            },
        });

        if (!comprobante) {
            throw noEncontrado(
            `No existe el comprobante ${detalle.voucher_id}.`
            );
        }

        const nuevoPagado =
            Number(comprobante.paid_amount) + Number(detalle.applied_amount);

        if (nuevoPagado > Number(comprobante.total_amount)) {
            throw conflicto(
            'El pago supera el saldo pendiente de uno de los comprobantes.'
            );
        }

        await tx.supplier_voucher.update({
            where: {
            voucher_id: detalle.voucher_id,
            },
            data: {
            paid_amount: nuevoPagado,
            },
        });
        }

        await tx.supplier_account_movement.create({
        data: {
            supplier_id: orden.supplier_id,
            concept: `Pago orden #${orden.payment_order_id}`,
            debit: 0,
            credit: orden.total_amount,
            payment_order_id: orden.payment_order_id,
            employees_id: orden.employees_id,
        },
        });

        return tx.payment_order.update({
        where: {
            payment_order_id: paymentOrderId,
        },
        data: {
            payment_order_status: 1,
            confirmed_date: new Date(),
        },
        });
    });
    };

    // ============================================================
    // RESET PROV-07
    // ============================================================

    const resetear = async (id, payload = {}) => {
    const paymentOrderId = toId(id);
    const motivo = toText(payload.reset_reason);
    const employeeId = toId(payload.employees_id) || env.DEFAULT_EMPLOYEE_ID;

    if (!paymentOrderId) {
        throw invalido('La orden de pago no es válida.');
    }

    if (!motivo) {
        throw invalido('Ingresá el motivo del reseteo.');
    }

    return prisma.$transaction(async (tx) => {
        const orden = await tx.payment_order.findUnique({
        where: {
            payment_order_id: paymentOrderId,
        },
        include: {
            payment_order_detail: true,
        },
        });

        if (!orden) {
        throw noEncontrado('La orden de pago no existe.');
        }

        if (orden.payment_order_status !== 1) {
        throw conflicto('Solo se pueden resetear órdenes confirmadas.');
        }

        for (const detalle of orden.payment_order_detail) {
        const comprobante = await tx.supplier_voucher.findUnique({
            where: {
            voucher_id: detalle.voucher_id,
            },
        });

        if (!comprobante) {
            throw noEncontrado(
            `No existe el comprobante ${detalle.voucher_id}.`
            );
        }

        const nuevoPagado =
            Number(comprobante.paid_amount) - Number(detalle.applied_amount);

        await tx.supplier_voucher.update({
            where: {
            voucher_id: detalle.voucher_id,
            },
            data: {
            paid_amount: Math.max(0, nuevoPagado),
            },
        });
        }

        const movimientoOriginal =
        await tx.supplier_account_movement.findFirst({
            where: {
            payment_order_id: paymentOrderId,
            credit: {
                gt: 0,
            },
            },
            orderBy: {
            account_movement_id: 'desc',
            },
        });

        if (!movimientoOriginal) {
        throw conflicto(
            'No se encontró el movimiento de cuenta corriente asociado al pago.'
        );
        }

        await tx.supplier_account_movement.create({
        data: {
            supplier_id: orden.supplier_id,
            concept: `Reversión orden #${paymentOrderId}`,
            debit: orden.total_amount,
            credit: 0,
            payment_order_id: paymentOrderId,
            reversal_of_movement_id:
            movimientoOriginal.account_movement_id,
            employees_id: employeeId,
        },
        });

        await tx.payment_order_reset.create({
        data: {
            payment_order_id: paymentOrderId,
            employees_id: employeeId,
            restored_amount: orden.total_amount,
            reset_reason: motivo,
        },
        });

        return tx.payment_order.update({
        where: {
            payment_order_id: paymentOrderId,
        },
        data: {
            payment_order_status: 0,
            confirmed_date: null,
        },
        });
    });
    };

    module.exports = {
    listar,
    obtener,
    listarMetodosPago,
    obtenerCuentaCorriente,
    crear,
    agregarDetalle,
    confirmar,
    resetear,
    };