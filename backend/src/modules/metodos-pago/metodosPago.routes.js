const { Router } = require('express');
const c = require('./metodosPago.controller');

const router = Router();
router.get('/', c.listar);

module.exports = router;