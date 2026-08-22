const { Router } = require('express');
const { getStockByDeposit } = require('../controllers/stock.controller');

const router = Router();

// La ruta interna debe ser '/deposit/:depositId'
router.get('/deposit/:depositId', getStockByDeposit);

module.exports = router;