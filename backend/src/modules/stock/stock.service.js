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
    where: { articles: { article_state: true } },
    select: {
      stock_id: true,
      stock_amount: true,
      update_date: true,
      articles: {
        select: {
          article_id: true,
          article_code: true,
          article_name: true,
          article_unit_of_measure: true,
          article_stock_min_general: true,
        },
      },
      deposit: { select: { deposit_id: true, deposit_name: true } },
    },
    orderBy: [{ deposit: { deposit_name: 'asc' } }, { articles: { article_name: 'asc' } }],
  });

/** Saldo de un depósito puntual. */
const getStockPorDeposito = async (depositoId) => {
  const depositId = toId(depositoId);
  if (!depositId) throw invalido('El identificador del depósito no es válido.');

  const deposito = await prisma.deposit.findUnique({ where: { deposit_id: depositId } });
  if (!deposito) throw noEncontrado('El depósito no existe.');

  return prisma.articles_deposit_stock.findMany({
    where: { deposit_id: depositId },
    include: {
      articles: { include: { categories: { select: { category_name: true } } } },
      deposit: true,
    },
    orderBy: { articles: { article_name: 'asc' } },
  });
};

/**
 * Tipos de movimiento activos (STK-04).
 * El frontend arma sus opciones con esto, así nunca puede mandar un tipo
 * que no exista en la base.
 */
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
          articles: { select: { article_code: true, article_name: true } },
          deposit: { select: { deposit_id: true, deposit_name: true } },
        },
      },
    },
  },
};

/** Historial filtrable por depósito y por tipo (STK-05). */
const getHistorial = async ({ deposito, tipo } = {}) => {
  const depositoId = toId(deposito);
  const tipoTexto = toText(tipo);

  return prisma.stock_movement.findMany({
    where: {
      ...(tipoTexto ? { movement_type: { movement_type: tipoTexto } } : {}),
      ...(depositoId
        ? {
            OR: [{ deposit_origin_id: depositoId }, { deposit_destination_id: depositoId }],
          }
        : {}),
    },
    include: includeMovimiento,
    orderBy: { transaction_date: 'desc' },
  });
};

// ---------------------------------------------------------------------------
// Operaciones atómicas sobre el stock
// ---------------------------------------------------------------------------

/**
 * Suma stock. Si el artículo nunca estuvo en ese depósito, crea la fila.
 * Usa `increment` para que dos movimientos simultáneos no se pisen: el cálculo
 * lo hace PostgreSQL, no JavaScript.
 */
const sumarStock = async (tx, articleId, depositId, cantidad) => {
  const stock = await tx.articles_deposit_stock.upsert({
    where: { article_id_deposit_id: { article_id: articleId, deposit_id: depositId } },
    create: { article_id: articleId, deposit_id: depositId, stock_amount: cantidad },
    update: { stock_amount: { increment: cantidad } },
  });
  return stock.stock_id;
};

/**
 * Resta stock con un UPDATE condicional: solo descuenta si la fila todavía
 * tiene saldo suficiente en ese instante. Si otro movimiento se adelantó,
 * `count` queda en 0 y la transacción se revierte con un mensaje claro, en
 * lugar de dejar el stock en negativo o chocar contra el CHECK de la base.
 */
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

/**
 * Normaliza el renglón de artículos.
 *
 * Se aceptan dos formas:
 *   - multi-artículo: { details: [{ articleId | article_code, amount }] }
 *   - un solo artículo: { article_code, amount }
 *
 * Los renglones repetidos del mismo artículo se suman en uno solo, porque
 * movement_stock_detail tiene UNIQUE (stock_movement_id, stock_id) y dos filas
 * del mismo artículo violarían esa restricción.
 */
const normalizarItems = (payload) => {
  const crudos =
    Array.isArray(payload.details) && payload.details.length
      ? payload.details
      : [{ article_code: payload.article_code, amount: payload.amount }];

  const items = crudos.map((d, i) => {
    const cantidad = toPositive(d.amount ?? d.cantidad);
    if (!cantidad) {
      throw invalido(`La cantidad del renglón ${i + 1} tiene que ser mayor a cero.`);
    }

    const articleId = toId(d.articleId ?? d.article_id);
    const codigo = toText(d.article_code ?? d.codigo);
    if (!articleId && !codigo) {
      throw invalido(`Falta el artículo en el renglón ${i + 1}.`);
    }

    return { articleId, codigo, cantidad };
  });

  // Se fusionan los renglones repetidos del mismo artículo.
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

/** Busca el artículo por id o por código y valida que se pueda mover. */
const resolverArticulo = async (item) => {
  const articulo = item.articleId
    ? await prisma.articles.findUnique({ where: { article_id: item.articleId } })
    : await prisma.articles.findUnique({ where: { article_code: item.codigo } });

  const referencia = item.codigo ?? `#${item.articleId}`;
  if (!articulo) throw noEncontrado(`No existe ningún artículo con la referencia ${referencia}.`);
  if (!articulo.article_state) {
    throw conflicto(`El artículo ${articulo.article_code} está dado de baja.`);
  }

  return { ...item, articulo };
};

/**
 * Registra un movimiento de stock (STK-05).
 *
 * Payload:
 * {
 *   movement_type_id:       number,        // obligatorio, FK a movement_type
 *   details:                [{ article_code | articleId, amount }],
 *   deposit_origin_id:      number | null, // según el efecto del tipo
 *   deposit_destination_id: number | null, // según el efecto del tipo
 *   supplier_id:            number | null, // opcional
 *   employees_id:           number | null, // lo inyecta el controller
 *   observations:           string | null
 * }
 *
 * Un movimiento puede llevar VARIOS artículos: van todos bajo una misma
 * cabecera y, si falla cualquier renglón, se revierte el movimiento completo.
 *
 * La dirección NO se decide por el nombre del tipo sino por su columna
 * `effect`. Así, cualquier tipo nuevo dado de alta desde la ABM de STK-04
 * funciona sin tocar este archivo.
 */
const crearMovimiento = async (payload = {}) => {
  // ---- 1. Tipo de movimiento ----
  // Se acepta por id (forma nueva) o por nombre (forma vieja de las pantallas
  // de stock y transferencias, y de la rama STK-05).
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

  // ---- 2. Artículos ----
  const items = [];
  for (const item of normalizarItems(payload)) {
    items.push(await resolverArticulo(item));
  }

  // ---- 3. Depósitos según el efecto ----
  const necesitaOrigen = tipo.effect === EFFECT.RESTA || tipo.effect === EFFECT.TRANSFERENCIA;
  const necesitaDestino = tipo.effect === EFFECT.SUMA || tipo.effect === EFFECT.TRANSFERENCIA;

  const origenId = necesitaOrigen ? toId(payload.deposit_origin_id ?? payload.depositId) : null;
  let destinoId = necesitaDestino
    ? toId(payload.deposit_destination_id ?? payload.destinationDepositId)
    : null;

  /**
   * Compatibilidad con el payload viejo: cuando deposit_origin_id era NOT NULL,
   * las pantallas mandaban el depósito de DESTINO en el campo de origen para
   * los ingresos. Si llega un movimiento que suma sin destino pero con origen,
   * se interpreta ese origen como el destino real.
   */
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

  // ---- 4. Empleado y proveedor ----
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

  // ---- 5. Transacción ----
  return prisma.$transaction(async (tx) => {
    // Una fila de detalle por cada fila de stock afectada. En una
    // transferencia son dos por artículo: la de origen y la de destino.
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
