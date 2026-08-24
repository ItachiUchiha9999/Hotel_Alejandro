const prisma = require('../db/prisma');
const ExcelJS = require('exceljs');

// Criterio 1: saldo consolidado de articles_deposit_stock, agrupado por depósito
async function getSaldoConsolidado(req, res) {
  try {
    const saldo = await prisma.articles_deposit_stock.findMany({
      where: { articles: { article_state: true } },
      select: {
        stock_amount: true,
        articles: {
          select: { article_code: true, article_name: true, article_unit_of_measure: true },
        },
        deposit: {
          select: { deposit_name: true },
        },
      },
      orderBy: [
        { deposit: { deposit_name: 'asc' } },
        { articles: { article_name: 'asc' } },
      ],
    });

    res.json(saldo);
  } catch (error) {
    console.error('Error en getSaldoConsolidado:', error);
    res.status(500).json({ error: 'Error al obtener el saldo consolidado' });
  }
}

// Criterio 2: historial de movimientos, filtrable por depósito y tipo de movimiento
async function getHistorialMovimientos(req, res) {
  try {
    const { deposito, tipo } = req.query;
    const depositoId = deposito ? parseInt(deposito, 10) : undefined;

    const movimientos = await prisma.stock_movement.findMany({
      where: {
        ...(tipo && { stock_movement_operation_type: tipo }),
        ...(depositoId && {
          OR: [
            { deposit_origin_id: depositoId },
            { deposit_destination_id: depositoId },
          ],
        }),
      },
      include: {
        employees: {
          select: { employees_name: true, employees_lastname: true },
        },
        deposit_stock_movement_deposit_origin_idTodeposit: {
          select: { deposit_name: true },
        },
        deposit_stock_movement_deposit_destination_idTodeposit: {
          select: { deposit_name: true },
        },
        movement_stock_detail: {
          include: {
            articles_deposit_stock: {
              include: { articles: { select: { article_name: true, article_code: true } } },
            },
          },
        },
      },
      orderBy: { transaction_date: 'desc' },
    });

    res.json(movimientos);
  } catch (error) {
    console.error('Error en getHistorialMovimientos:', error);
    res.status(500).json({ error: 'Error al obtener el historial de movimientos' });
  }
}

// Criterio 3: exportar historial de movimientos a Excel para auditoría
async function exportarHistorialExcel(req, res) {
  try {
    const { deposito, tipo } = req.query;
    const depositoId = deposito ? parseInt(deposito, 10) : undefined;

    const movimientos = await prisma.stock_movement.findMany({
      where: {
        ...(tipo && { stock_movement_operation_type: tipo }),
        ...(depositoId && {
          OR: [
            { deposit_origin_id: depositoId },
            { deposit_destination_id: depositoId },
          ],
        }),
      },
      include: {
        employees: { select: { employees_name: true, employees_lastname: true } },
        deposit_stock_movement_deposit_origin_idTodeposit: { select: { deposit_name: true } },
        deposit_stock_movement_deposit_destination_idTodeposit: { select: { deposit_name: true } },
        movement_stock_detail: {
          include: {
            articles_deposit_stock: {
              include: { articles: { select: { article_name: true, article_code: true } } },
            },
          },
        },
      },
      orderBy: { transaction_date: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Historial de Movimientos');

    sheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 20 },
      { header: 'Tipo', key: 'tipo', width: 15 },
      { header: 'Depósito Origen', key: 'origen', width: 25 },
      { header: 'Depósito Destino', key: 'destino', width: 25 },
      { header: 'Artículo', key: 'articulo', width: 30 },
      { header: 'Cantidad', key: 'cantidad', width: 12 },
      { header: 'Empleado', key: 'empleado', width: 25 },
      { header: 'Observaciones', key: 'observaciones', width: 35 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const mov of movimientos) {
      const origen = mov.deposit_stock_movement_deposit_origin_idTodeposit?.deposit_name || '';
      const destino = mov.deposit_stock_movement_deposit_destination_idTodeposit?.deposit_name || '';
      const empleado = `${mov.employees.employees_name} ${mov.employees.employees_lastname}`;

      if (mov.movement_stock_detail.length === 0) {
        sheet.addRow({
          fecha: mov.transaction_date,
          tipo: mov.stock_movement_operation_type,
          origen,
          destino,
          articulo: '',
          cantidad: '',
          empleado,
          observaciones: mov.observations || '',
        });
      } else {
        for (const detalle of mov.movement_stock_detail) {
          const articulo = detalle.articles_deposit_stock?.articles?.article_name || '(sin artículo)';
          sheet.addRow({
            fecha: mov.transaction_date,
            tipo: mov.stock_movement_operation_type,
            origen,
            destino,
            articulo,
            cantidad: Number(detalle.amount),
            empleado,
            observaciones: mov.observations || '',
          });
        }
      }
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=historial-movimientos.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error en exportarHistorialExcel:', error);
    res.status(500).json({ error: 'Error al exportar el historial a Excel' });
  }
}

module.exports = { getSaldoConsolidado, getHistorialMovimientos, exportarHistorialExcel };