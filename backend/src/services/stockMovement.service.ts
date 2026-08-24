import prisma from "../lib/prisma";

type StockMovementType = "INGRESO" | "EGRESO" | "TRANSFERENCIA";

interface MovementDetailData {
  articleId: number;
  amount: number;
}

interface CreateStockMovementData {
  type: StockMovementType;
  depositId: number;
  employeeId: number;
  observations?: string;
  destinationDepositId?: number;
  details: MovementDetailData[];
}

export async function createStockMovement(
  data: CreateStockMovementData
) {
  const {
    type,
    depositId,
    employeeId,
    destinationDepositId,
    observations,
    details,
  } = data;

  if (!details || details.length === 0) {
    throw new Error("Debe agregar al menos un artículo");
  }

  if (type === "TRANSFERENCIA" && !destinationDepositId) {
    throw new Error("Debe indicar un depósito destino");
  }

  if (
    type === "TRANSFERENCIA" &&
    destinationDepositId === depositId
  ) {
    throw new Error(
      "El depósito destino debe ser distinto al depósito origen"
    );
  }

  for (const detail of details) {
    if (!Number.isInteger(detail.amount) || detail.amount <= 0) {
      throw new Error(
        "Las cantidades deben ser números enteros mayores a 0"
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    /*
      Primero buscamos y validamos todos los stocks.

      Esto es importante porque si estamos haciendo un EGRESO
      y uno de los artículos no tiene stock suficiente,
      cancelamos todo el movimiento.
    */
    const validatedDetails = [];

    for (const detail of details) {
      const stock =
        await tx.articles_deposit_stock.findUnique({
          where: {
            article_id_deposit_id: {
              article_id: detail.articleId,
              deposit_id: depositId,
            },
          },
        });

      /*
        Para INGRESO puede ocurrir que el artículo todavía no tenga
        un registro de stock en ese depósito.

        En EGRESO y TRANSFERENCIA sí tiene que existir.
      */
      if (
        !stock &&
        (type === "EGRESO" || type === "TRANSFERENCIA")
      ) {
        throw new Error(
          `El artículo ${detail.articleId} no tiene stock en el depósito seleccionado`
        );
      }

      if (
        stock &&
        (type === "EGRESO" || type === "TRANSFERENCIA") &&
        Number(stock.stock_amount) < detail.amount
      ) {
        throw new Error(
          `Stock insuficiente para el artículo ${detail.articleId}`
        );
      }

      validatedDetails.push({
        ...detail,
        stock,
      });
    }

    /*
      Creamos UNA cabecera de movimiento.
      Todos los artículos van a pertenecer a este movimiento.
    */
    const movement = await tx.stock_movement.create({
      data: {
        stock_movement_operation_type: type,
        deposit_origin_id: depositId,
        deposit_destination_id:
          type === "TRANSFERENCIA"
            ? destinationDepositId
            : null,
        employees_id: employeeId,
        observations,
      },
    });

    /*
      Ahora procesamos cada artículo.
    */
    for (const detail of validatedDetails) {
      let sourceStock = detail.stock;

      /*
        INGRESO:
        si ese artículo nunca estuvo en ese depósito,
        creamos su registro de stock.
      */
      if (!sourceStock && type === "INGRESO") {
        sourceStock =
          await tx.articles_deposit_stock.create({
            data: {
              article_id: detail.articleId,
              deposit_id: depositId,
              stock_amount: 0,
            },
          });
      }

      if (!sourceStock) {
        throw new Error(
          `No se pudo obtener el stock del artículo ${detail.articleId}`
        );
      }

      /*
        Guardamos el detalle.
      */
      await tx.movement_stock_detail.create({
        data: {
          stock_movement_id:
            movement.stock_movement_id,
          stock_id: sourceStock.stock_id,
          amount: detail.amount,
        },
      });

      /*
        INGRESO = suma stock.
      */
      if (type === "INGRESO") {
        await tx.articles_deposit_stock.update({
          where: {
            stock_id: sourceStock.stock_id,
          },
          data: {
            stock_amount: {
              increment: detail.amount,
            },
            update_date: new Date(),
          },
        });
      }

      /*
        EGRESO = resta stock.
      */
      if (type === "EGRESO") {
        await tx.articles_deposit_stock.update({
          where: {
            stock_id: sourceStock.stock_id,
          },
          data: {
            stock_amount: {
              decrement: detail.amount,
            },
            update_date: new Date(),
          },
        });
      }

      /*
        TRANSFERENCIA:
        resta del origen
        y suma en el destino.
      */
      if (type === "TRANSFERENCIA") {
        await tx.articles_deposit_stock.update({
          where: {
            stock_id: sourceStock.stock_id,
          },
          data: {
            stock_amount: {
              decrement: detail.amount,
            },
            update_date: new Date(),
          },
        });

        const destinationStock =
          await tx.articles_deposit_stock.findUnique({
            where: {
              article_id_deposit_id: {
                article_id: detail.articleId,
                deposit_id: destinationDepositId!,
              },
            },
          });

        if (destinationStock) {
          await tx.articles_deposit_stock.update({
            where: {
              stock_id: destinationStock.stock_id,
            },
            data: {
              stock_amount: {
                increment: detail.amount,
              },
              update_date: new Date(),
            },
          });
        } else {
          await tx.articles_deposit_stock.create({
            data: {
              article_id: detail.articleId,
              deposit_id: destinationDepositId!,
              stock_amount: detail.amount,
            },
          });
        }
      }
    }

    return movement;
  });
}