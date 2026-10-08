const { Router } = require('express');
const controller = require('./dashboard.controller');

const router = Router();
router.get('/finanzas/exportar', controller.exportarFinanzas);
router.get('/finanzas', controller.finanzas);

module.exports = router;
