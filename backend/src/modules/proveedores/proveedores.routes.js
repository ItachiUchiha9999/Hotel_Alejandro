const { Router } = require('express');
const prisma = require('../../db/prisma');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * Listado de proveedores. Lo necesita el selector del alta de comprobantes
 * (PROV-01). El ABM completo de proveedores no está en el alcance del sprint.
 */
const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await prisma.suppliers.findMany({
      where: req.query.activos === 'true' ? { supplier_state: true } : undefined,
      orderBy: { supplier_legal_name: 'asc' },
      select: {
        supplier_id: true,
        supplier_legal_name: true,
        supplier_trade_name: true,
        supplier_cuit: true,
        supplier_state: true,
      },
    });
    res.json({ ok: true, data });
  })
);

module.exports = router;
