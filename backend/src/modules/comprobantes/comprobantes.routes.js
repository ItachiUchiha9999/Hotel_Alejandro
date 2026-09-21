const { Router } = require('express');
const c = require('./comprobantes.controller');

const router = Router();

router.get('/', c.listar);
router.post('/', c.crear);
router.get('/ordenes-aprobadas/:supplierId', c.ordenesCompraAprobadas);
router.get('/:id', c.obtener);

module.exports = router;