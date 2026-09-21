const asyncHandler = require('../../utils/asyncHandler');

const service = require('./tarifas.service');

const listar = asyncHandler(async (req, res) => {
  const data = await service.listar({
    tipo: req.query.tipo,
    soloVigentes: req.query.soloVigentes,
  });

  res.json({
    ok: true,
    data,
  });
});

const obtener = asyncHandler(async (req, res) => {
  const data = await service.obtener(
    req.params.id
  );

  res.json({
    ok: true,
    data,
  });
});

const crear = asyncHandler(async (req, res) => {
  const data = await service.crear(
    req.body
  );

  res.status(201).json({
    ok: true,
    message: `Tarifa de ${data.room_type.room_type_name} registrada correctamente.`,
    data,
  });
});

module.exports = {
  listar,
  obtener,
  crear,
};