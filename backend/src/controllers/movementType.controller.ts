import type { Request, Response } from "express";

import {
  createMovementType,
  getMovementTypes,
  updateMovementType,
  updateMovementTypeStatus,
} from "../services/movementType.service";

export async function getMovementTypesController(
  _req: Request,
  res: Response
) {
  try {
    const types = await getMovementTypes();

    return res.json(types);
  } catch {
    return res.status(500).json({
      error: "Error al obtener los tipos de movimiento",
    });
  }
}

export async function updateMovementTypeController(
  req: Request,
  res: Response
) {
  try {
    const id = Number(req.params.id);

    const { description, effect } = req.body;

    const updatedType = await updateMovementType(
      id,
      description,
      effect
    );

    return res.json({
      message: "Tipo de movimiento actualizado correctamente",
      movementType: updatedType,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Error al actualizar el tipo de movimiento";

    return res.status(400).json({
      error: message,
    });
  }
}

export async function updateMovementTypeStatusController(
  req: Request,
  res: Response
) {
  try {
    const id = Number(req.params.id);

    const { active } = req.body;

    if (typeof active !== "boolean") {
      return res.status(400).json({
        error: "El estado debe ser true o false",
      });
    }

    const updatedType = await updateMovementTypeStatus(
      id,
      active
    );

    return res.json({
      message: active
        ? "Tipo de movimiento activado correctamente"
        : "Tipo de movimiento desactivado correctamente",
      movementType: updatedType,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Error al cambiar el estado";

    return res.status(400).json({
      error: message,
    });
  }
}
export async function createMovementTypeController(
  req: Request,
  res: Response
) {
  try {
    const {
      movementType,
      description,
      effect,
    } = req.body;

    const newType = await createMovementType(
      String(movementType ?? ""),
      String(description ?? ""),
      String(effect ?? "")
    );

    return res.status(201).json({
      message: "Tipo de movimiento creado correctamente",
      movementType: newType,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Error al crear el tipo de movimiento";

    return res.status(400).json({
      error: message,
    });
  }
}