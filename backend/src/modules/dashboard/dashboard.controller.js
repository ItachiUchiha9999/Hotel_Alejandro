const asyncHandler = require('../../utils/asyncHandler');
const { invalido } = require('../../utils/AppError');
const service = require('./dashboard.service');
const { crearExcel, crearPdf } = require('./finanzas.exportar');

const finanzas = asyncHandler(async (req, res) => {
  const data = await service.consultarFinanzas({ periodo: req.query.periodo, fecha: req.query.fecha });
  res.json({ ok: true, data });
});

const exportarFinanzas = asyncHandler(async (req, res) => {
  const formato = req.query.formato;
  if (!['pdf', 'xlsx'].includes(formato)) throw invalido('El formato debe ser pdf o xlsx.');
  const reporte = await service.consultarFinanzas({ periodo: req.query.periodo, fecha: req.query.fecha });
  const archivo = formato === 'pdf' ? await crearPdf(reporte) : await crearExcel(reporte).xlsx.writeBuffer();
  res.type(formato === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="rentabilidad-${reporte.desde}-${reporte.hasta}-${reporte.periodo.toLowerCase()}.${formato}"`);
  res.send(Buffer.from(archivo));
});

module.exports = { finanzas, exportarFinanzas };
