const { Router } = require('express');
const c = require('./stock.controller');

const router = Router();

// ---- Consultas de saldo (STK-03) ----
router.get('/', c.getSaldoConsolidado);
router.get('/deposito/:depositoId', c.getStockPorDeposito);

// ---- Tipos de movimiento (STK-04) ----
router.get('/tipos-movimiento', c.getTiposMovimiento);

// ---- Movimientos (STK-05) ----
// La ruta de exportación va ANTES que /movimientos para que Express no la
// tome como un parámetro de esa ruta.
router.get('/movimientos/exportar', c.exportarHistorial);
router.get('/movimientos', c.getHistorial);
router.post('/movimientos', c.crearMovimiento);

// ---- Alias en inglés, por compatibilidad con pantallas ya escritas ----
router.get('/deposit/:depositoId', c.getStockPorDeposito);
router.get('/movement-types', c.getTiposMovimiento);
router.post('/movements', c.crearMovimiento);
// La rama STK-05 posteaba a la raíz de /api/stock-movements.
router.post('/', c.crearMovimiento);

module.exports = router;
