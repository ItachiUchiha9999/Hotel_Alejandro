import { Router } from "express";

import {
  createMovementTypeController,
  getMovementTypesController,
  updateMovementTypeController,
  updateMovementTypeStatusController,
} from "../controllers/movementType.controller";

const router = Router();

router.get("/", getMovementTypesController);

router.post("/", createMovementTypeController);

router.put("/:id", updateMovementTypeController);

router.patch(
  "/:id/status",
  updateMovementTypeStatusController
);

export default router;