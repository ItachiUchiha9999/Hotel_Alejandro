const asyncHandler = require('../../utils/asyncHandler');
const service = require('./reportes.service');

const obtenerOcupacionTemporadas = asyncHandler(async (req, res) => {
  const data = await service.ocupacionPorTemporadas({
    desde: req.query.desde,
    hasta: req.query.hasta,
    temporada: req.query.temporada,
    tipo: req.query.tipo,
  });

  res.json({
    ok: true,
    data,
  });
});

module.exports = {
  obtenerOcupacionTemporadas,
};