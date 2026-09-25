const express = require('express');
const controller = require('./ordenesCompra.controller');

const router = express.Router();

router.get(
  '/',
  controller.listar
);

router.get(
  '/:id',
  controller.obtener
);

router.post(
  '/',
  controller.crear
);

/*
 * Editar una orden de compra.
 * Solo se permite si está en BORRADOR.
 */
router.patch(
  '/:id',
  controller.editar
);

/*
 * Cambiar solamente el estado
 * de una orden.
 */
router.patch(
  '/:id/estado',
  controller.cambiarEstado
);

module.exports = router;