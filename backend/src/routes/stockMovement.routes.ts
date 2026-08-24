import { Router } from "express";
import { createStockMovementController } from "../controllers/stockMovement.controller";

const router = Router();

router.post("/", createStockMovementController);

export default router;