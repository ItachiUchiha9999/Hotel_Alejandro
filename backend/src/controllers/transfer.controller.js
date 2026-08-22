const service = require('../services/transfer.service');

async function crearTransferencia(req, res) {
  try {
    const {
      article_id,
      deposit_origin_id,
      deposit_destination_id,
      amount,
      employees_id,
      observations,
    } = req.body;

    if (
      article_id === undefined ||
      deposit_origin_id === undefined ||
      deposit_destination_id === undefined ||
      amount === undefined ||
      employees_id === undefined
    ) {
      return res.status(400).json({
        error:
          'Faltan campos obligatorios: article_id, deposit_origin_id, deposit_destination_id, amount, employees_id.',
      });
    }

    const movimiento = await service.registrarTransferencia({
      article_id: Number(article_id),
      deposit_origin_id: Number(deposit_origin_id),
      deposit_destination_id: Number(deposit_destination_id),
      amount,
      employees_id: Number(employees_id),
      observations,
    });

    return res.status(201).json({ mensaje: 'Transferencia registrada correctamente.', movimiento });
  } catch (err) {
    console.error(err);
    return res
      .status(err.status || 500)
      .json({ error: err.message || 'Error interno al registrar la transferencia.' });
  }
}

async function obtenerTransferencias(req, res) {
  try {
    return res.json(await service.listarTransferencias());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al listar las transferencias.' });
  }
}

module.exports = { crearTransferencia, obtenerTransferencias };
