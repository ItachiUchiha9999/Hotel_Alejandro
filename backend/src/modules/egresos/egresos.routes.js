const { Router } = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { invalido } = require('../../utils/AppError');
const service = require('./egresos.service');
const { crearExcel, crearPdf } = require('./egresos.exportar');

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await service.consultar(req.query) });
}));

router.get('/exportar', asyncHandler(async (req, res) => {
  const formato = req.query.formato;
  if (!['pdf', 'xlsx'].includes(formato)) throw invalido('El formato debe ser pdf o xlsx.');
  const reporte = await service.consultar(req.query);
  const archivo = formato === 'pdf' ? await crearPdf(reporte) : await crearExcel(reporte).xlsx.writeBuffer();
  res.type(formato === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="egresos-${reporte.desde}-${reporte.hasta}-${reporte.agrupacion.toLowerCase()}.${formato}"`);
  res.send(Buffer.from(archivo));
}));

module.exports = router;