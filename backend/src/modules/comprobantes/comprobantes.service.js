const prisma = require('../../db/prisma');
const { Prisma } = require('@prisma/client');
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
 * PROV-04 — "Consultar y administrar comprobantes de un proveedor" agrega a
 * `listar` los filtros combinables por tipo, estado y rango de fechas (ver
 * abajo). El detalle con movimientos de cuenta relacionados queda para
 * PROV-05/06.
 */

/** Fecha en formato YYYY-MM-DD, o null si no es válida. */
const toDate = (valor) => {
  const texto = toText(valor);
  if (!texto) return null;
  const fecha = new Date(`${texto}T00:00:00`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

/** Estados válidos de comprobante (coincide con el CHECK de la base). */
const ESTADOS_VALIDOS = ['PENDIENTE', 'PAGADO', 'ANULADO'];

/** Estado de comprobante en mayúsculas si es válido, o null. No filtra si viene vacío. */
const toEstado = (valor) => {
  const texto = toText(valor);
  if (!texto) return null;
  const estado = texto.toUpperCase();
  if (!ESTADOS_VALIDOS.includes(estado)) {
    throw invalido(`El estado "${valor}" no es válido. Usá PENDIENTE, PAGADO o ANULADO.`);
  }
  return estado;
};

/**
 * Los datos de lectura salen de la vista v_supplier_voucher_balance, que ya
 * calcula el saldo pendiente y marca los vencidos. Prisma no mapea vistas, así
 * que se consulta con SQL crudo.
 *
 * Filtros combinables, todos opcionales (AND entre los que estén presentes):
 *   - supplierId:     v_supplier_voucher_balance.supplier_id
 *   - voucherTypeId:  id del tipo de comprobante (voucher_type.voucher_type_id)
 *   - estado:         voucher_status ('PENDIENTE' | 'PAGADO' | 'ANULADO')
 *   - desde / hasta:  rango sobre issue_date, formato 'YYYY-MM-DD'
 *
 * Nota sobre voucherTypeId: la vista expone `voucher_type` como el NOMBRE del
 * tipo (texto), no su ID — no tiene columna voucher_type_id (ver columnas de
 * la vista en la definición de la tarea). Por eso, cuando se filtra por
 * voucherTypeId, se une con la tabla voucher_type por el nombre (que es
 * UNIQUE) para poder comparar por ID en vez de por texto. Si en algún momento
 * se agrega voucher_type_id directamente a la vista, este JOIN deja de ser
 * necesario y se puede filtrar sobre v.voucher_type_id sin tocar voucher_type.
 * Avisen si prefieren resolverlo agregando la columna a la vista en su lugar.
 *
 * Los comprobantes ANULADOS (baja lógica) se siguen listando igual que
 * cualquier otro estado: no hay ningún filtro implícito que los oculte, salvo
 * que se pida explícitamente `estado` distinto de ANULADO.
 */
const listar = async (filtros = {}) => {
  const supplierId = toId(filtros.supplierId);
  const voucherTypeId = toId(filtros.voucherTypeId);
  const estado = toEstado(filtros.estado);
  const desde = toDate(filtros.desde);
  const hasta = toDate(filtros.hasta);

  if (desde && hasta && hasta < desde) {
    throw invalido('El rango de fechas no es válido: "hasta" no puede ser anterior a "desde".');
  }

  const condiciones = [];
  if (supplierId) condiciones.push(Prisma.sql`v.supplier_id = ${supplierId}`);
  if (estado) condiciones.push(Prisma.sql`v.voucher_status = ${estado}`);
  if (desde) condiciones.push(Prisma.sql`v.issue_date >= ${desde}`);
  if (hasta) condiciones.push(Prisma.sql`v.issue_date <= ${hasta}`);

  // El JOIN con voucher_type solo se agrega cuando hace falta filtrar por ID
  // de tipo: así, sin ese filtro, la consulta queda idéntica a la anterior.
  let origen = Prisma.sql`v_supplier_voucher_balance v`;
  if (voucherTypeId) {
    origen = Prisma.sql`v_supplier_voucher_balance v
      JOIN voucher_type vt ON vt.voucher_type = v.voucher_type`;
    condiciones.push(Prisma.sql`vt.voucher_type_id = ${voucherTypeId}`);
  }

  const where = condiciones.length
    ? Prisma.sql`WHERE ${Prisma.join(condiciones, ' AND ')}`
    : Prisma.empty;

  return prisma.$queryRaw`
    SELECT v.*
    FROM ${origen}
    ${where}
    ORDER BY v.issue_date DESC, v.voucher_id DESC`;
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