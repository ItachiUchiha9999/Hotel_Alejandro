import { Router } from "express";
import prisma from "../lib/prisma";

const router = Router();

router.get("/stocks", async (_req, res) => {
  try {
    const stocks = await prisma.articles_deposit_stock.findMany({
      include: {
        articles: true,
        deposit: true,
      },
      orderBy: {
        stock_id: "asc",
      },
    });

    res.json(stocks);
  } catch {
    res.status(500).json({
      error: "Error al obtener los stocks",
    });
  }
});

router.get("/employees", async (_req, res) => {
  try {
    const employees = await prisma.employees.findMany({
      where: {
        employees_state: true,
      },
      orderBy: {
        employees_name: "asc",
      },
    });

    res.json(employees);
  } catch {
    res.status(500).json({
      error: "Error al obtener los empleados",
    });
  }
});

router.get("/deposits", async (_req, res) => {
  try {
    const deposits = await prisma.deposit.findMany({
      where: {
        deposit_state: true,
      },
      orderBy: {
        deposit_name: "asc",
      },
    });

    res.json(deposits);
  } catch {
    res.status(500).json({
      error: "Error al obtener los depósitos",
    });
  }
});

export default router;