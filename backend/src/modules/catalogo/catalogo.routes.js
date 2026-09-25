const { Router } = require('express');
const prisma = require('../../db/prisma');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * Endpoints de catálogo que consumía la rama STK-05 para poblar sus selectores.
 * Se mantienen para no romper esas pantallas, pero devuelven la misma envoltura
 * { ok, data } que el resto de la API.
 */
const router = Router();

router.get(
  '/stocks',
  asyncHandler(async (_req, res) => {
    const data = await prisma.articles_deposit_stock.findMany({
      include: { articles: true, deposit: true },
      orderBy: { stock_id: 'asc' },
    });
    res.json({ ok: true, data });
  })
);

router.get(
  '/employees',
  asyncHandler(async (_req, res) => {
    const data = await prisma.employees.findMany({
      where: { employees_state: true },
      orderBy: { employees_name: 'asc' },
      select: {
        employees_id: true,
        employees_name: true,
        employees_lastname: true,
        employees_email: true,
      },
    });
    res.json({ ok: true, data });
  })
);

router.get(
  '/deposits',
  asyncHandler(async (_req, res) => {
    const data = await prisma.deposit.findMany({
      where: { deposit_state: true },
      orderBy: { deposit_name: 'asc' },
    });
    res.json({ ok: true, data });
  })
);

module.exports = router;
