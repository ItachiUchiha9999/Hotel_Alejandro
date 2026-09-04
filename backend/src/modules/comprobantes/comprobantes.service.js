const prisma = require('../../db/prisma');
const env = require('../../config/env');
const { noEncontrado, conflicto, invalido } = require('../../utils/AppError');
const { toId, toPositive, toText } = require('../../utils/parse');

/**
 * Comprobantes de proveedores — PROV-01 (registrar la recepción).
 *
 * Criterios de aceptación cubiertos:
 *   - permite seleccionar proveedor y tipo de comprobante
 *   - registra número, fecha, importe total y estado
 *   - no permite duplicar un comprobante para el mismo proveedor
 *   - queda como pendiente de pago al ingresar
 *
 * El listado de acá es el mínimo para poder ver lo que se registra. Los filtros
 * por tipo, fecha y estado, y el detalle con saldos, son de PROV-03.
 */

/** Fecha en formato YYYY-MM-DD, o null si no es válida. */
const toDate = (valor) => {
  const texto = toText(valor);
  if (!texto) return null;
  const fecha = new Date(`${texto}T00:00:00`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

/**
 * Los datos de lectura salen de la vista v_supplier_voucher_balance, que ya
 * calcula el saldo pendiente y marca los vencidos. Prisma no mapea vistas, así
 * que se consulta con SQL crudo.
 */
const listar = async ({ supplierId } = {}) => {
  const id = toId(supplierId);

  if (id) {
    return prisma.$queryRaw`
      SELECT * FROM v_supplier_voucher_balance
      WHERE supplier_id = ${id}
      ORDER BY issue_date DESC, voucher_id DESC`;
  }

  return prisma.$queryRaw`
    SELECT * FROM v_supplier_voucher_balance
    ORDER BY issue_date DESC, voucher_id DESC`;
};

const obtener = async (id) => {
  const voucherId = toId(id);
  if (!voucherId) throw invalido('El identificador del comprobante no es válido.');

  const comprobante = await prisma.supplier_voucher.findUnique({
    where: { voucher_id: voucherId },
    include: {
      suppliers: { select: { supplier_id: true, supplier_legal_name: true, supplier_trade_name: true } },
      voucher_type: true,
      employees: { select: { employees_name: true, employees_lastname: true } },
    },
  });

  if (!comprobante) throw noEncontrado('El comprobante no existe.');
  return comprobante;
};

/**
 * Registra un comprobante recibido.
 *
 * Payload:
 * {
 *   supplier_id:           number,        // obligatorio
 *   voucher_type_id:       number,        // obligatorio
 *   voucher_point_of_sale: string,        // opcional, por defecto '0001'
 *   voucher_number:        string,        // obligatorio
 *   issue_date:            'YYYY-MM-DD',  // obligatorio
 *   due_date:              'YYYY-MM-DD',  // opcional
 *   total_amount:          number,        // obligatorio, > 0
 *   observations:          string | null,
 *   employees_id:          number | null  // lo inyecta el controller
 * }
 *
 * El estado NO se recibe del cliente: lo calcula el trigger de la base a partir
 * de los importes, así que un comprobante nuevo siempre nace PENDIENTE.
 */
const crear = async (payload = {}) => {
  // ---- 1. Formato ----
  const supplierId = toId(payload.supplier_id ?? payload.proveedorId);
  if (!supplierId) throw invalido('Elegí el proveedor.');

  const typeId = toId(payload.voucher_type_id ?? payload.tipoId);
  if (!typeId) throw invalido('Elegí el tipo de comprobante.');

  const numero = toText(payload.voucher_number ?? payload.numero);
  if (!numero) throw invalido('Ingresá el número del comprobante.');

  const puntoVenta = toText(payload.voucher_point_of_sale ?? payload.puntoVenta) || '0001';

  const emision = toDate(payload.issue_date ?? payload.fechaEmision);
  if (!emision) throw invalido('Ingresá una fecha de emisión válida.');

  const vencimiento = toDate(payload.due_date ?? payload.fechaVencimiento);
  if (vencimiento && vencimiento < emision) {
    throw invalido('La fecha de vencimiento no puede ser anterior a la de emisión.');
  }

  const importe = toPositive(payload.total_amount ?? payload.importe);
  if (!importe) throw invalido('El importe total tiene que ser mayor a cero.');

  const employeeId = toId(payload.employees_id) || env.DEFAULT_EMPLOYEE_ID;

  // ---- 2. Validación contra la base ----
  const proveedor = await prisma.suppliers.findUnique({ where: { supplier_id: supplierId } });
  if (!proveedor) throw noEncontrado('El proveedor no existe.');
  if (!proveedor.supplier_state) {
    throw conflicto(`El proveedor "${proveedor.supplier_legal_name}" está inactivo.`);
  }

  const tipo = await prisma.voucher_type.findUnique({ where: { voucher_type_id: typeId } });
  if (!tipo) throw noEncontrado('El tipo de comprobante no existe.');
  if (!tipo.active) throw conflicto(`El tipo "${tipo.voucher_type}" está inactivo.`);

  const empleado = await prisma.employees.findUnique({ where: { employees_id: employeeId } });
  if (!empleado) throw invalido('No se pudo identificar al empleado que registra el comprobante.');

  // ---- 3. Duplicados ----
  // La base ya tiene el UNIQUE (proveedor, tipo, punto de venta, número), pero
  // se chequea antes para devolver un mensaje entendible en lugar de un P2002.
  const yaExiste = await prisma.supplier_voucher.findFirst({
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

  // ---- 4. Alta ----
  /**
   * El comprobante y su movimiento de cuenta corriente se crean juntos: si
   * falla uno, no queda el otro suelto. El signo del tipo decide de qué lado
   * del libro mayor se anota (+1 debe, -1 haber).
   *
   * Los tipos con affects_account = false (remito, recibo) se registran pero no
   * mueven la cuenta.
   */
  return prisma.$transaction(async (tx) => {
    const comprobante = await tx.supplier_voucher.create({
      data: {
        supplier_id: supplierId,
        voucher_type_id: typeId,
        voucher_point_of_sale: puntoVenta,
        voucher_number: numero,
        issue_date: emision,
        due_date: vencimiento,
        total_amount: importe,
        observations: toText(payload.observations ?? payload.observaciones),
        employees_id: employeeId,
      },
      include: {
        suppliers: { select: { supplier_legal_name: true, supplier_trade_name: true } },
        voucher_type: true,
      },
    });

    if (tipo.affects_account) {
      await tx.supplier_account_movement.create({
        data: {
          supplier_id: supplierId,
          concept: `${tipo.voucher_type} ${puntoVenta}-${numero}`,
          debit: tipo.sign === 1 ? importe : 0,
          credit: tipo.sign === -1 ? importe : 0,
          voucher_id: comprobante.voucher_id,
          employees_id: employeeId,
        },
      });
    }

    return comprobante;
  });
};

module.exports = { listar, obtener, crear };
