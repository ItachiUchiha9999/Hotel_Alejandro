const { Router } = require('express');
const { crearTransferencia, obtenerTransferencias } = require('../controllers/transfer.controller');

const router = Router();

router.post('/', crearTransferencia);
router.get('/', obtenerTransferencias);

module.exports = router;
