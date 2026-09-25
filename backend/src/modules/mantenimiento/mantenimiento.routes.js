const { Router } = require('express');
const controller = require('./mantenimiento.controller');

const router = Router();

router.get('/', controller.listar);
router.post('/', controller.registrar);
router.patch('/:id/cerrar', controller.cerrar);

module.exports = router;