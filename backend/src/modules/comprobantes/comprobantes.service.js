const prisma = require('../../db/prisma');

const { Prisma } = require('@prisma/client');

const env = require('../../config/env');

const { noEncontrado, conflicto, invalido } = require('../../utils/AppError');

const { toId, toPositive, toText } = require('../../utils/parse');

/**
 * Comprobantes de proveedores — PROV-01 / PROV-04.
 *
 * PROV-04 agrega filtros combinables por proveedor, tipo, estado y rango de fechas.
 * PROV-07 reutiliza este listado con payable=true para mostrar solamente
 * comprobantes que pueden pagarse mediante órdenes de pago.
 */

/** Fecha en formato YYYY-MM-DD, o null si no es válida. */
const toDate = (valor) => {
  const texto = toText(valor);

  if (!texto) return null;

  const fecha = new Date(`${texto}T00:00:00`);

  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

/** Estados válidos de comprobante. */
const ESTADOS_VALIDOS = ['PENDIENTE', 'PAGADO', 'ANULADO'];

const toEstado = (valor) => {
  const texto = toText(valor);

  if (!texto) return null;

  const estado = texto.toUpperCase();

  if (!ESTADOS_VALIDOS.includes(estado)) {
    throw invalido(
      `El estado "${valor}" no es válido. Usá PENDIENTE, PAGADO o ANULADO.`
    );
  }

  return estado;
};

/**
 * Listado con filtros combinables.
 *
 * filtros:
 * - supplierId
 * - voucherTypeId
 * - estado
 * - desde
 * - hasta
 * - payable
 */
const listar = async (filtros = {}) => {
  const supplierId = toId(filtros.supplierId);

  const voucherTypeId = toId(filtros.voucherTypeId);

  const estado = toEstado(filtros.estado);

  const desde = toDate(filtros.desde);

  const hasta = toDate(filtros.hasta);

  const payable = filtros.payable === true;

  if (desde && hasta && hasta < desde) {
    throw invalido(
      'El rango de fechas no es válido: "hasta" no puede ser anterior a "desde".'
    );
  }

  const condiciones = [];

  if (supplierId) {
    condiciones.push(
      Prisma.sql`v.supplier_id = ${supplierId}`
    );
  }

  if (estado) {
    condiciones.push(
      Prisma.sql`v.voucher_status = ${estado}`
    );
  }

  if (desde) {
    condiciones.push(
      Prisma.sql`v.issue_date >= ${desde}`
    );
  }

  if (hasta) {
    condiciones.push(
      Prisma.sql`v.issue_date <= ${hasta}`
    );
  }

  /**
   * La vista expone voucher_type como nombre, no como id.
   * Entonces necesitamos unir con voucher_type cuando:
   * - filtramos por voucherTypeId
   * - filtramos por payable
   */
  let origen = Prisma.sql`v_supplier_voucher_balance v`;

  if (voucherTypeId || payable) {
    origen = Prisma.sql`
      v_supplier_voucher_balance v
      JOIN voucher_type vt
        ON vt.voucher_type = v.voucher_type
    `;
  }

  if (voucherTypeId) {
    condiciones.push(
      Prisma.sql`vt.voucher_type_id = ${voucherTypeId}`
    );
  }

  if (payable) {
    condiciones.push(
      Prisma.sql`vt.is_payable = TRUE`
    );
  }

  const where = condiciones.length
    ? Prisma.sql`WHERE ${Prisma.join(condiciones, ' AND ')}`
    : Prisma.empty;

  return prisma.$queryRaw`
    SELECT v.*
    FROM ${origen}
    ${where}
    ORDER BY v.issue_date DESC, v.voucher_id DESC
  `;
};

/**
 * Obtener un comprobante por id.
 */
const obtener = async (id) => {
  const voucherId = toId(id);

  if (!voucherId) {
    throw invalido(
      'El identificador del comprobante no es válido.'
    );
  }

  const comprobante =
    await prisma.supplier_voucher.findUnique({
      where: {
        voucher_id: voucherId,
      },

      include: {
        suppliers: {
          select: {
            supplier_id: true,
            supplier_legal_name: true,
            supplier_trade_name: true,
          },
        },

        voucher_type: true,

        employees: {
          select: {
            employees_name: true,
            employees_lastname: true,
          },
        },
      },
    });

  if (!comprobante) {
    throw noEncontrado('El comprobante no existe.');
  }

  return comprobante;
};

/**
 * Registrar un comprobante recibido.
 */
const crear = async (payload = {}) => {
  // ============================================================
  // 1. FORMATO
  // ============================================================

  const supplierId = toId(
    payload.supplier_id ?? payload.proveedorId
  );

  if (!supplierId) {
    throw invalido('Elegí el proveedor.');
  }

  const typeId = toId(
    payload.voucher_type_id ?? payload.tipoId
  );

  if (!typeId) {
    throw invalido('Elegí el tipo de comprobante.');
  }

  const numero = toText(
    payload.voucher_number ?? payload.numero
  );

  if (!numero) {
    throw invalido(
      'Ingresá el número del comprobante.'
    );
  }

  const puntoVenta =
    toText(
      payload.voucher_point_of_sale ??
        payload.puntoVenta
    ) || '0001';

  const emision = toDate(
    payload.issue_date ?? payload.fechaEmision
  );

  if (!emision) {
    throw invalido(
      'Ingresá una fecha de emisión válida.'
    );
  }

  const vencimiento = toDate(
    payload.due_date ?? payload.fechaVencimiento
  );

  if (vencimiento && vencimiento < emision) {
    throw invalido(
      'La fecha de vencimiento no puede ser anterior a la de emisión.'
    );
  }

  const importe = toPositive(
    payload.total_amount ?? payload.importe
  );

  if (!importe) {
    throw invalido(
      'El importe total tiene que ser mayor a cero.'
    );
  }

  const employeeId =
    toId(payload.employees_id) ||
    env.DEFAULT_EMPLOYEE_ID;

  // ============================================================
  // 2. VALIDACIONES
  // ============================================================

  const proveedor =
    await prisma.suppliers.findUnique({
      where: {
        supplier_id: supplierId,
      },
    });

  if (!proveedor) {
    throw noEncontrado(
      'El proveedor no existe.'
    );
  }

  if (!proveedor.supplier_state) {
    throw conflicto(
      `El proveedor "${proveedor.supplier_legal_name}" está inactivo.`
    );
  }

  const tipo =
    await prisma.voucher_type.findUnique({
      where: {
        voucher_type_id: typeId,
      },
    });

  if (!tipo) {
    throw noEncontrado(
      'El tipo de comprobante no existe.'
    );
  }

  if (!tipo.active) {
    throw conflicto(
      `El tipo "${tipo.voucher_type}" está inactivo.`
    );
  }

  const empleado =
    await prisma.employees.findUnique({
      where: {
        employees_id: employeeId,
      },
    });

  if (!empleado) {
    throw invalido(
      'No se pudo identificar al empleado que registra el comprobante.'
    );
  }

  // ============================================================
  // 3. DUPLICADOS
  // ============================================================

  const yaExiste =
    await prisma.supplier_voucher.findFirst({
      where: {
        supplier_id: supplierId,
        voucher_type_id: typeId,
        voucher_point_of_sale: puntoVenta,
        voucher_number: numero,
      },
    });

  if (yaExiste) {
    throw conflicto(
      `El proveedor ya tiene registrado el comprobante ${tipo.voucher_type} ` +
        `${puntoVenta}-${numero}.`
    );
  }

  // ============================================================
  // 4. CREACIÓN
  // ============================================================

  return prisma.$transaction(async (tx) => {
    const comprobante =
      await tx.supplier_voucher.create({
        data: {
          supplier_id: supplierId,
          voucher_type_id: typeId,
          voucher_point_of_sale: puntoVenta,
          voucher_number: numero,
          issue_date: emision,
          due_date: vencimiento,
          total_amount: importe,

          observations: toText(
            payload.observations ??
              payload.observaciones
          ),

          employees_id: employeeId,
        },

        include: {
          suppliers: {
            select: {
              supplier_legal_name: true,
              supplier_trade_name: true,
            },
          },

          voucher_type: true,
        },
      });

    /**
     * Si el tipo afecta la cuenta corriente:
     *
     * sign = 1  → DEBE
     * sign = -1 → HABER
     */
    if (tipo.affects_account) {
      await tx.supplier_account_movement.create({
        data: {
          supplier_id: supplierId,

          concept:
            `${tipo.voucher_type} ` +
            `${puntoVenta}-${numero}`,

          debit:
            tipo.sign === 1
              ? importe
              : 0,

          credit:
            tipo.sign === -1
              ? importe
              : 0,

          voucher_id:
            comprobante.voucher_id,

          employees_id:
            employeeId,
        },
      });
    }

    return comprobante;
  });
};

module.exports = {
  listar,
  obtener,
  crear,
};