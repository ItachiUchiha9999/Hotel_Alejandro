const { Router } = require('express');
const c = require('./condicionesFiscales.controller');

const router = Router();
router.get('/', c.listar);

module.exports = router;