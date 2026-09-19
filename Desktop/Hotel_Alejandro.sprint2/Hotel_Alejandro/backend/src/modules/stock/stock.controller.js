const ExcelJS = require('exceljs');
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./stock.service');

const getSaldoConsolidado = asyncHandler(async (req, res) => {
  const data = await service.getSaldoConsolidado();
  res.json({ ok: true, data });
});

const getStockPorDeposito = asyncHandler(async (req, res) => {
  const data = await service.getStockPorDeposito(req.params.depositoId);
  res.json({ ok: true, data });
});

const getTiposMovimiento = asyncHandler(async (req, res) => {
  const data = await service.getTiposMovimiento();
  res.json({ ok: true, data });
});

const getHistorial = asyncHandler(async (req, res) => {
  const data = await service.getHistorial(req.query);
  res.json({ ok: true, data });
});

const crearMovimiento = asyncHandler(async (req, res) => {
  const data = await service.crearMovimiento({
    ...req.body,
    // Cuando exista login (STK-06), acá va req.user.employees_id.
    employees_id: req.body.employees_id ?? null,
  });
  res.status(201).json({ ok: true, message: 'Movimiento registrado.', data });
});

/** Exportación del historial a Excel, para auditoría. */
const exportarHistorial = asyncHandler(async (req, res) => {
  const movimientos = await service.getHistorial(req.query);

  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet('Historial de Movimientos');

  hoja.columns = [
    { header: 'Fecha', key: 'fecha', width: 22 },
    { header: 'Tipo', key: 'tipo', width: 18 },
    { header: 'Efecto', key: 'efecto', width: 15 },
    { header: 'Depósito origen', key: 'origen', width: 28 },
    { header: 'Depósito destino', key: 'destino', width: 28 },
    { header: 'Artículo', key: 'articulo', width: 32 },
    { header: 'Cantidad', key: 'cantidad', width: 12 },
    { header: 'Empleado', key: 'empleado', width: 26 },
    { header: 'Observaciones', key: 'observaciones', width: 38 },
  ];
  hoja.getRow(1).font = { bold: true };

  for (const mov of movimientos) {
    const base = {
      fecha: mov.transaction_date,
      tipo: mov.movement_type?.movement_type ?? '',
      efecto: mov.movement_type?.effect ?? '',
      origen: mov.deposit_origin?.deposit_name ?? '',
      destino: mov.deposit_destination?.deposit_name ?? '',
      empleado: `${mov.employees.employees_name} ${mov.employees.employees_lastname}`,
      observaciones: mov.observations ?? '',
    };

    if (mov.movement_stock_detail.length === 0) {
      hoja.addRow({ ...base, articulo: '', cantidad: '' });
      continue;
    }

    // En una transferencia hay dos filas de detalle (origen y destino) para el
    // mismo artículo; se muestra una sola para no duplicar la cantidad.
    const vistos = new Set();
    for (const det of mov.movement_stock_detail) {
      const art = det.articles_deposit_stock?.articles;
      const clave = art?.article_code ?? det.detail_id;
      if (vistos.has(clave)) continue;
      vistos.add(clave);

      hoja.addRow({
        ...base,
        articulo: art ? `${art.article_code} — ${art.article_name}` : '(sin artículo)',
        cantidad: Number(det.amount),
      });
    }
  }

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', 'attachment; filename=historial-movimientos.xlsx');

  await workbook.xlsx.write(res);
  res.end();
});

module.exports = {
  getSaldoConsolidado,
  getStockPorDeposito,
  getTiposMovimiento,
  getHistorial,
  crearMovimiento,
  exportarHistorial,
};
