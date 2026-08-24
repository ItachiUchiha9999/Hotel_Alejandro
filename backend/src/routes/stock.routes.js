const express = require('express');
const router = express.Router();

const {
  getSaldoConsolidado,
  getHistorialMovimientos,
  exportarHistorialExcel,
} = require('../controllers/stock.controller');

// GET /api/stock -> saldo consolidado por depósito
router.get('/', getSaldoConsolidado);

// GET /api/stock/movimientos?deposito=&tipo= -> historial filtrable
router.get('/movimientos', getHistorialMovimientos);

// GET /api/stock/movimientos/exportar?deposito=&tipo= -> descarga Excel
router.get('/movimientos/exportar', exportarHistorialExcel);

module.exports = router;