const prisma = require('../utils/prisma');

const getStockByDeposit = async (depositId) => {
  return await prisma.articles_deposit_stock.findMany({
    where: {
      deposit_id: Number(depositId),
    },
    include: {
      articles: {
        include: {
          categories: true,
        },
      },
      deposit: true,
    },
  });
};

const createMovement = async (data) => {
  const {
    stock_movement_operation_type,
    article_code,
    deposit_origin_id,
    deposit_destination_id,
    amount,
    observations,
  } = data;

  // 1. Buscar el artículo por su código
  const article = await prisma.articles.findUnique({
    where: { article_code: article_code },
  });

  if (!article) {
    throw new Error(`El artículo con código '${article_code}' no existe en el catálogo.`);
  }

  const numericAmount = Number(amount);
  const originId = deposit_origin_id ? Number(deposit_origin_id) : null;
  const destId = deposit_destination_id ? Number(deposit_destination_id) : null;

  return await prisma.$transaction(async (tx) => {
    // 2. Obtener o crear el registro de stock para el origen o destino
    let stockRecord = null;

    if (originId) {
      stockRecord = await tx.articles_deposit_stock.findFirst({
        where: {
          article_id: article.article_id,
          deposit_id: originId,
        },
      });

      if (!stockRecord || Number(stockRecord.stock_amount) < numericAmount) {
        throw new Error('Stock insuficiente en el depósito de origen.');
      }

      // Descontar del origen
      await tx.articles_deposit_stock.update({
        where: { stock_id: stockRecord.stock_id },
        data: { stock_amount: Number(stockRecord.stock_amount) - numericAmount },
      });
    }

    if (destId) {
      const destStock = await tx.articles_deposit_stock.findFirst({
        where: {
          article_id: article.article_id,
          deposit_id: destId,
        },
      });

      if (destStock) {
        await tx.articles_deposit_stock.update({
          where: { stock_id: destStock.stock_id },
          data: { stock_amount: Number(destStock.stock_amount) + numericAmount },
        });
        if (!stockRecord) stockRecord = destStock;
      } else {
        const newStock = await tx.articles_deposit_stock.create({
          data: {
            article_id: article.article_id,
            deposit_id: destId,
            stock_amount: numericAmount,
          },
        });
        if (!stockRecord) stockRecord = newStock;
      }
    }

    // 3. Crear cabecera de movimiento (usamos employees_id = 1 de los datos semilla)
    const movement = await tx.stock_movement.create({
      data: {
        stock_movement_operation_type,
        deposit_origin_id: originId,
        deposit_destination_id: destId,
        employees_id: 1, // Asigna por defecto al empleado Admin/Carlos
        observations,
      },
    });

    // 4. Crear el detalle del movimiento
    if (stockRecord) {
      await tx.movement_stock_detail.create({
        data: {
          stock_movement_id: movement.stock_movement_id,
          stock_id: stockRecord.stock_id,
          amount: numericAmount,
        },
      });
    }

    return movement;
  });
};

module.exports = {
  getStockByDeposit,
  createMovement,
};