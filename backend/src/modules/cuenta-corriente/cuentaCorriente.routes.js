const { Router } = require('express');
const c = require('./cuentaCorriente.controller');

const router = Router();

// GET /api/cuenta-corriente/:supplierId?formaPago=&desde=&hasta=
router.get('/:supplierId', c.obtener);

module.exports = router;