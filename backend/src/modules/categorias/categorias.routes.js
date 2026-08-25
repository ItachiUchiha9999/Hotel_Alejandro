const { Router } = require('express');
const prisma = require('../../db/prisma');
const asyncHandler = require('../../utils/asyncHandler');

const router = Router();

/** Listado de categorías, para los selectores del catálogo de artículos. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await prisma.categories.findMany({
      where: req.query.activos === 'true' ? { category_state: true } : undefined,
      orderBy: { category_name: 'asc' },
    });
    res.json({ ok: true, data });
  })
);

module.exports = router;
