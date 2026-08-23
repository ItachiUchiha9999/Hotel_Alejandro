const { Router } = require('express');
const { getStockByDeposit, createStockMovement } = require('../controllers/stock.controller');

const router = Router();

// Consultar stock por depósito
router.get('/deposit/:depositId', getStockByDeposit);

// Registrar un nuevo movimiento de stock
router.post('/movements', createStockMovement);

module.exports = router;