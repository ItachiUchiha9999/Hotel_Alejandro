import type { Request, Response } from "express";
import { createStockMovement } from "../services/stockMovement.service";

export async function createStockMovementController(
  req: Request,
  res: Response
) {
  try {
    const {
      type,
      depositId,
      employeeId,
      destinationDepositId,
      observations,
      details,
    } = req.body;

    if (!Array.isArray(details) || details.length === 0) {
      return res.status(400).json({
        error: "Debe agregar al menos un artículo",
      });
    }

    const movement = await createStockMovement({
      type,
      depositId: Number(depositId),
      employeeId: Number(employeeId),
      destinationDepositId:
        destinationDepositId !== undefined &&
        destinationDepositId !== null &&
        destinationDepositId !== ""
          ? Number(destinationDepositId)
          : undefined,
      observations,
      details: details.map((detail) => ({
        articleId: Number(detail.articleId),
        amount: Number(detail.amount),
      })),
    });

    return res.status(201).json({
      message: "Movimiento registrado correctamente",
      movement,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Error al registrar el movimiento";

    return res.status(400).json({
      error: message,
    });
  }
}