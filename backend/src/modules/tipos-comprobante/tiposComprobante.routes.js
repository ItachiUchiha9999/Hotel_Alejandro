const { Router } = require('express');
const prisma = require('../../db/prisma');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * Catálogo de tipos de comprobante (PROV-02).
 * Por ahora solo lectura: el alta y la edición son parte de esa historia.
 */
const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await prisma.voucher_type.findMany({
      where: req.query.activos === 'true' ? { active: true } : undefined,
      orderBy: { voucher_type_id: 'asc' },
    });
    res.json({ ok: true, data });
  })
);

module.exports = router;
