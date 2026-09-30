const { Router } = require('express');
const controller = require('./dashboard.controller');

const router = Router();
router.get('/finanzas', controller.finanzas);

module.exports = router;
