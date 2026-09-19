const prisma = require('../../db/prisma');
const env = require('../../config/env');
const { noEncontrado, conflicto, invalido } = require('../../utils/AppError');
const { toId, toPositive, toText } = require('../../utils/parse');

/**
 * Efectos posibles de un tipo de movimiento.
 * Coinciden con el CHECK ck_movement_type_effect de la base.
 */
const EFFECT = {
  SUMA: 'SUMA',
  RESTA: 'RESTA',
  TRANSFERENCIA: 'TRANSFERENCIA',
};

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** Saldo consolidado de todos los depósitos (STK-03). */
const getSaldoConsolidado = async () =>
  prisma.articles_deposit_stock.findMany({
    where: {
      OR: [
        { articles: { article_state: true } },
        { stock_amount: { gt: 0 } },
      ],
    },
    select: {
      stock_id: true,
      stock_amount: true,
      update_date: true,
      articles: {
        select: {
          article_id: true,
          article_code: true,
          article_name: true,
          article_state: true,
          article_unit_of_measure: true,
          article_stock_min_general: true,
        },
      },
      deposit: { select: { deposit_id: true, deposit_name: true } },
    },
    orderBy: [{ deposit: { deposit_name: 'asc' } }, { articles: { article_name: 'asc' } }],
  });

/** Saldo de un depósito puntual con estado del artículo incluido. */
const getStockPorDeposito = async (depositoId) => {
  const depositId = toId(depositoId);
  if (!depositId) throw invalido('El identificador del depósito no es válido.');

  const deposito = await prisma.deposit.findUnique({ where: { deposit_id: depositId } });
  if (!deposito) throw noEncontrado('El depósito no existe.');

  return prisma.articles_deposit_stock.findMany({
    where: {
      deposit_id: depositId,
      OR: [
        { articles: { article_state: true } },
        { stock_amount: { gt: 0 } },
      ],
    },
    include: {
      articles: {
        select: {
          article_id: true,
          article_code: true,
          article_name: true,
          article_state: true,
          article_unit_of_measure: true,
          article_stock_min_general: true,
          categories: { select: { category_name: true } },
        },
      },
      deposit: true,
    },
    orderBy: { articles: { article_name: 'asc' } },
  });
};

/** Tipos de movimiento activos (STK-04). */
const getTiposMovimiento = async () =>
  prisma.movement_type.findMany({
    where: { active: true },
    orderBy: { movement_type_id: 'asc' },
    select: {
      movement_type_id: true,
      movement_type: true,
      description: true,
      effect: true,
    },
  });

/** Include compartido por el historial y la exportación a Excel. */
const includeMovimiento = {
  movement_type: true,
  employees: { select: { employees_name: true, employees_lastname: true } },
  suppliers: { select: { supplier_trade_name: true, supplier_legal_name: true } },
  deposit_origin: { select: { deposit_id: true, deposit_name: true } },
  deposit_destination: { select: { deposit_id: true, deposit_name: true } },
  movement_stock_detail: {
    include: {
      articles_deposit_stock: {
        include: {
          articles: { select: { article_code: true, article_name: true, article_state: true } },
          deposit: { select: { deposit_id: true, deposit_name: true } },
        },
      },
    },
  },
};

/** Historial filtrable por tipo, depósito de origen y/o destino, y rango de fechas (STK-05). */
const getHistorial = async ({ origen, destino, tipo, desde, hasta } = {}) => {
  const origenId = toId(origen);
  const destinoId = toId(destino);
  const tipoTexto = toText(tipo);

  const dateFilter = {};

  if (desde) {
    const [year, month, day] = desde.split('-').map(Number);
    dateFilter.gte = new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  if (hasta) {
    const [year, month, day] = hasta.split('-').map(Number);
    dateFilter.lte = new Date(year, month - 1, day, 23, 59, 59, 999);
  }

  return prisma.stock_movement.findMany({
    where: {
      ...(tipoTexto ? { movement_type: { movement_type: tipoTexto } } : {}),
      ...(origenId ? { deposit_origin_id: origenId } : {}),
      ...(destinoId ? { deposit_destination_id: destinoId } : {}),
      ...(Object.keys(dateFilter).length > 0 ? { transaction_date: dateFilter } : {}),
    },
    include: includeMovimiento,
    orderBy: { transaction_date: 'desc' },
  });
};

// ---------------------------------------------------------------------------
// Operaciones atómicas sobre el stock
// ---------------------------------------------------------------------------

const sumarStock = async (tx, articleId, depositId, cantidad) => {
  const stock = await tx.articles_deposit_stock.upsert({
    where: { article_id_deposit_id: { article_id: articleId, deposit_id: depositId } },
    create: { article_id: articleId, deposit_id: depositId, stock_amount: cantidad },
    update: { stock_amount: { increment: cantidad } },
  });
  return stock.stock_id;
};

const restarStock = async (tx, articleId, depositId, cantidad, codigo) => {
  const stock = await tx.articles_deposit_stock.findUnique({
    where: { article_id_deposit_id: { article_id: articleId, deposit_id: depositId } },
    include: { deposit: { select: { deposit_name: true } } },
  });

  if (!stock) {
    throw conflicto(`El artículo ${codigo} no tiene stock cargado en el depósito de origen.`);
  }

  const { count } = await tx.articles_deposit_stock.updateMany({
    where: { stock_id: stock.stock_id, stock_amount: { gte: cantidad } },
    data: { stock_amount: { decrement: cantidad } },
  });

  if (count === 0) {
    throw conflicto(
      `Stock insuficiente de ${codigo} en ${stock.deposit.deposit_name}. ` +
        `Disponible: ${stock.stock_amount}, solicitado: ${cantidad}.`
    );
  }

  return stock.stock_id;
};

// ---------------------------------------------------------------------------
// Alta de movimiento (STK-05)
// ---------------------------------------------------------------------------

const normalizarItems = (payload) => {
  const crudos =
    Array.isArray(payload.details) && payload.details.length
      ? payload.details
      : [{ article_code: payload.article_code, amount: payload.amount }];

  const items = crudos.map((d, i) => {
    const cantidad = toPositive(d.amount ?? d.cantidad);
    if (!cantidad) {
      throw invalido(`La cantidad del renglón ${i + 1} tiene que ser un número entero mayor a cero.`);
    }

    const articleId = toId(d.articleId ?? d.article_id);
    const codigo = toText(d.article_code ?? d.codigo);
    if (!articleId && !codigo) {
      throw invalido(`Falta el artículo en el renglón ${i + 1}.`);
    }

    return { articleId, codigo, cantidad };
  });

  const fusionados = new Map();
  for (const item of items) {
    const clave = item.articleId ?? item.codigo.toUpperCase();
    const previo = fusionados.get(clave);
    fusionados.set(
      clave,
      previo ? { ...previo, cantidad: previo.cantidad + item.cantidad } : item
    );
  }

  return [...fusionados.values()];
};

const resolverArticulo = async (item, tipo) => {
  const articulo = item.articleId
    ? await prisma.articles.findUnique({ where: { article_id: item.articleId } })
    : await prisma.articles.findUnique({ where: { article_code: item.codigo } });

  const referencia = item.codigo ?? `#${item.articleId}`;
  if (!articulo) throw noEncontrado(`No existe ningún artículo con la referencia ${referencia}.`);

  // Solo se permiten salidas (EGRESO, CONSUMO) para artículos dados de baja
  if (!articulo.article_state && tipo.effect !== EFFECT.RESTA) {
    throw conflicto(
      `El artículo ${articulo.article_code} está dado de baja. Solo se permiten movimientos de egreso o consumo para liquidar su stock.`
    );
  }

  return { ...item, articulo };
};

const crearMovimiento = async (payload = {}) => {
  let typeId = toId(payload.movement_type_id);

  if (!typeId) {
    const nombreTipo = toText(
      payload.movement_type ?? payload.stock_movement_operation_type ?? payload.type
    );
    if (nombreTipo) {
      const porNombre = await prisma.movement_type.findUnique({
        where: { movement_type: nombreTipo.toUpperCase() },
      });
      if (!porNombre) throw noEncontrado(`No existe el tipo de movimiento "${nombreTipo}".`);
      typeId = porNombre.movement_type_id;
    }
  }

  if (!typeId) throw invalido('Elegí un tipo de movimiento.');

  const tipo = await prisma.movement_type.findUnique({ where: { movement_type_id: typeId } });
  if (!tipo) throw noEncontrado('El tipo de movimiento no existe.');
  if (!tipo.active) throw conflicto(`El tipo "${tipo.movement_type}" está inactivo.`);
  if (!Object.values(EFFECT).includes(tipo.effect)) {
    throw new Error(`El tipo "${tipo.movement_type}" tiene un efecto no soportado: ${tipo.effect}`);
  }

  const items = [];
  for (const item of normalizarItems(payload)) {
    items.push(await resolverArticulo(item, tipo));
  }

  const necesitaOrigen = tipo.effect === EFFECT.RESTA || tipo.effect === EFFECT.TRANSFERENCIA;
  const necesitaDestino = tipo.effect === EFFECT.SUMA || tipo.effect === EFFECT.TRANSFERENCIA;

  const origenId = necesitaOrigen ? toId(payload.deposit_origin_id ?? payload.depositId) : null;
  let destinoId = necesitaDestino
    ? toId(payload.deposit_destination_id ?? payload.destinationDepositId)
    : null;

  if (necesitaDestino && !destinoId && !necesitaOrigen) {
    destinoId = toId(payload.deposit_origin_id ?? payload.depositId);
  }

  if (necesitaOrigen && !origenId) throw invalido('Elegí el depósito de origen.');
  if (necesitaDestino && !destinoId) throw invalido('Elegí el depósito de destino.');
  if (tipo.effect === EFFECT.TRANSFERENCIA && origenId === destinoId) {
    throw invalido('El depósito de origen y el de destino deben ser distintos.');
  }

  const idsDepositos = [...new Set([origenId, destinoId].filter(Boolean))];
  const depositos = await prisma.deposit.findMany({ where: { deposit_id: { in: idsDepositos } } });

  if (depositos.length !== idsDepositos.length) {
    throw noEncontrado('Alguno de los depósitos seleccionados no existe.');
  }
  const inactivo = depositos.find((d) => !d.deposit_state);
  if (inactivo) throw conflicto(`El depósito "${inactivo.deposit_name}" está inactivo.`);

  const employeeId = toId(payload.employees_id ?? payload.employeeId) || env.DEFAULT_EMPLOYEE_ID;
  const empleado = await prisma.employees.findUnique({ where: { employees_id: employeeId } });
  if (!empleado) {
    throw invalido('No se pudo identificar al empleado que registra el movimiento.');
  }

  const supplierId = toId(payload.supplier_id ?? payload.supplierId);
  if (supplierId) {
    const proveedor = await prisma.suppliers.findUnique({ where: { supplier_id: supplierId } });
    if (!proveedor) throw noEncontrado('El proveedor seleccionado no existe.');
  }

  return prisma.$transaction(async (tx) => {
    const detalles = [];

    for (const item of items) {
      const articleId = item.articulo.article_id;
      const codigo = item.articulo.article_code;

      if (origenId) {
        detalles.push({
          stock_id: await restarStock(tx, articleId, origenId, item.cantidad, codigo),
          amount: item.cantidad,
        });
      }
      if (destinoId) {
        detalles.push({
          stock_id: await sumarStock(tx, articleId, destinoId, item.cantidad),
          amount: item.cantidad,
        });
      }
    }

    const movimiento = await tx.stock_movement.create({
      data: {
        movement_type_id: tipo.movement_type_id,
        deposit_origin_id: origenId,
        deposit_destination_id: destinoId,
        employees_id: employeeId,
        supplier_id: supplierId,
        observations: toText(payload.observations),
      },
    });

    await tx.movement_stock_detail.createMany({
      data: detalles.map((d) => ({
        stock_movement_id: movimiento.stock_movement_id,
        stock_id: d.stock_id,
        amount: d.amount,
      })),
    });

    return tx.stock_movement.findUnique({
      where: { stock_movement_id: movimiento.stock_movement_id },
      include: includeMovimiento,
    });
  });
};

module.exports = {
  EFFECT,
  getSaldoConsolidado,
  getStockPorDeposito,
  getTiposMovimiento,
  getHistorial,
  crearMovimiento,
};