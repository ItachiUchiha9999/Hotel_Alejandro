import prisma from "../lib/prisma";

export async function getMovementTypes() {
  return prisma.movement_type.findMany({
    orderBy: {
      movement_type_id: "asc",
    },
  });
}

export async function updateMovementType(
  id: number,
  description: string,
  effect: string
) {
  if (!description.trim()) {
    throw new Error("La descripción es obligatoria");
  }

  if (!["SUMA", "RESTA", "TRANSFERENCIA"].includes(effect)) {
    throw new Error("El efecto no es válido");
  }

  return prisma.movement_type.update({
    where: {
      movement_type_id: id,
    },
    data: {
      description,
      effect,
    },
  });
}

export async function updateMovementTypeStatus(
  id: number,
  active: boolean
) {
  return prisma.movement_type.update({
    where: {
      movement_type_id: id,
    },
    data: {
      active,
    },
  });
}
export async function createMovementType(
  movementType: string,
  description: string,
  effect: string
) {
  if (!movementType.trim()) {
    throw new Error("El tipo es obligatorio");
  }

  if (!description.trim()) {
    throw new Error("La descripción es obligatoria");
  }

  if (!["SUMA", "RESTA"].includes(effect)) {
    throw new Error("El efecto debe ser SUMA o RESTA");
  }

  return prisma.movement_type.create({
    data: {
      movement_type: movementType.trim().toUpperCase(),
      description: description.trim(),
      effect,
      active: true,
    },
  });
}