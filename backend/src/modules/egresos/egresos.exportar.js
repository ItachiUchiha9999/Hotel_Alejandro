const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const moneda = valor => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(valor);
const fecha = valor => valor.split('-').reverse().join('/');
const nombreCategoria = new Map([
  ['PROVEEDORES', 'Pagos a proveedores'],
  ['COMPRAS_STOCK', 'Compras de stock'],
  ['GASTOS_OPERATIVOS', 'Gastos operativos'],
]);

function crearExcel(reporte) {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Hotel Alejandro I';

  const resumen = libro.addWorksheet('Resumen');
  resumen.columns = [{ width: 34 }, { width: 48 }, { width: 20 }];
  resumen.addRows([
    ['Hotel Alejandro I - Egresos'],
    ['Desde', reporte.desde],
    ['Hasta', reporte.hasta],
    ['Agrupación', reporte.agrupacion],
    ['Total del período', reporte.total],
    ['Categoría de mayor peso', reporte.categoria_principal?.nombre ?? 'Sin egresos'],
    ['Importe de la categoría principal', reporte.categoria_principal?.importe ?? 0],
    ['Participación', (reporte.categoria_principal?.porcentaje ?? 0) / 100],
    [],
    ['Categoría', 'Importe'],
    ...reporte.categorias.map(categoria => [categoria.nombre, categoria.importe]),
    [],
    ['Fuente', 'Órdenes de pago confirmadas; cada importe aplicado se contabiliza una sola vez.'],
  ]);
  for (const cell of ['B5', 'B7', 'B11', 'B12', 'B13']) resumen.getCell(cell).numFmt = '"$" #,##0.00';
  resumen.getCell('B8').numFmt = '0.00%';
  resumen.getRow(1).font = { bold: true, size: 16 };

  const serie = libro.addWorksheet('Períodos');
  serie.columns = [
    { header: 'Desde', key: 'desde', width: 16 },
    { header: 'Hasta', key: 'hasta', width: 16 },
    { header: 'Pagos a proveedores', key: 'PROVEEDORES', width: 24 },
    { header: 'Compras de stock', key: 'COMPRAS_STOCK', width: 22 },
    { header: 'Gastos operativos', key: 'GASTOS_OPERATIVOS', width: 22 },
    { header: 'Total', key: 'total', width: 20 },
    { header: 'Acumulado', key: 'acumulado', width: 20 },
  ];
  for (const periodo of reporte.serie) {
    serie.addRow({ desde: periodo.desde, hasta: periodo.hasta, ...periodo.categorias, total: periodo.total, acumulado: periodo.acumulado });
  }
  for (let columna = 3; columna <= 7; columna++) serie.getColumn(columna).numFmt = '"$" #,##0.00';

  const detalle = libro.addWorksheet('Egresos');
  detalle.columns = [
    { header: 'Fecha de pago', key: 'fecha', width: 16 },
    { header: 'Categoría', key: 'categoria', width: 24 },
    { header: 'Proveedor', key: 'proveedor', width: 32 },
    { header: 'Comprobante', key: 'detalle', width: 58 },
    { header: 'Orden de pago', key: 'payment_order_id', width: 16 },
    { header: 'Importe', key: 'importe', width: 20 },
  ];
  detalle.addRows(reporte.movimientos.map(movimiento => ({
    ...movimiento,
    categoria: nombreCategoria.get(movimiento.categoria) ?? movimiento.categoria,
  })));
  detalle.getColumn('importe').numFmt = '"$" #,##0.00';

  for (const hoja of [resumen, serie, detalle]) {
    hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF302B25' } };
    hoja.views = [{ state: 'frozen', ySplit: 1 }];
  }
  for (const hoja of [serie, detalle]) {
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, hoja.rowCount), column: hoja.columnCount } };
  }
  return libro;
}

function crearPdf(reporte) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true,
      info: { Title: 'Egresos - Hotel Alejandro I', Author: 'Hotel Alejandro I' } });
    const partes = [];
    doc.on('data', parte => partes.push(parte));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(partes)));

    doc.font('Helvetica-Bold').fontSize(20).fillColor('#302b25').text('Hotel Alejandro I | Egresos');
    doc.font('Helvetica').fontSize(10).text(`${fecha(reporte.desde)} al ${fecha(reporte.hasta)} · Agrupación: ${reporte.agrupacion === 'MES' ? 'Mes' : 'Semana'} · Moneda: ARS`);
    doc.moveDown().font('Helvetica-Bold').fontSize(14).text(`Total del período: ${moneda(reporte.total)}`);
    doc.font('Helvetica').fontSize(10).text(`Categoría de mayor peso: ${reporte.categoria_principal ? `${reporte.categoria_principal.nombre} · ${moneda(reporte.categoria_principal.importe)} (${reporte.categoria_principal.porcentaje.toLocaleString('es-AR', { maximumFractionDigits: 2 })}%)` : 'Sin egresos en el período'}`);
    doc.moveDown().fontSize(9).text('Fuente: importes aplicados a órdenes de pago confirmadas. Las órdenes de compra y comprobantes no se suman por separado.');

    function tabla(titulo, encabezados, anchos, filas) {
      let y = doc.y + 12;
      const anchoTotal = anchos.reduce((suma, ancho) => suma + ancho, 0);
      function cabecera() {
        if (y > doc.page.height - 70) { doc.addPage(); y = 36; }
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#302b25').text(titulo, 36, y);
        y = doc.y + 9;
        doc.rect(36, y, anchoTotal, 22).fill('#302b25');
        let x = 36;
        encabezados.forEach((texto, indice) => {
          doc.font('Helvetica-Bold').fontSize(8).fillColor('white').text(texto, x + 4, y + 6, { width: anchos[indice] - 8, lineBreak: false });
          x += anchos[indice];
        });
        y += 22;
      }
      cabecera();
      for (const fila of filas) {
        const celdas = fila.map(String);
        const alto = Math.max(22, ...celdas.map((valor, indice) => doc.heightOfString(valor, { width: anchos[indice] - 8 }) + 10));
        if (y + alto > doc.page.height - 48) { doc.addPage(); y = 36; cabecera(); }
        let x = 36;
        celdas.forEach((valor, indice) => {
          doc.font('Helvetica').fontSize(8).fillColor('#302b25').text(valor, x + 4, y + 5, { width: anchos[indice] - 8 });
          x += anchos[indice];
        });
        doc.moveTo(36, y + alto).lineTo(36 + anchoTotal, y + alto).strokeColor('#e8e0d4').lineWidth(0.5).stroke();
        y += alto;
      }
      doc.y = y + 10;
    }

    tabla('Resumen por período', ['Desde - Hasta', 'Pagos a proveedores', 'Compras de stock', 'Gastos operativos', 'Total', 'Acumulado'], [154, 126, 126, 126, 100, 100],
      reporte.serie.map(periodo => [
        `${fecha(periodo.desde)} - ${fecha(periodo.hasta)}`,
        ...['PROVEEDORES', 'COMPRAS_STOCK', 'GASTOS_OPERATIVOS'].map(id => moneda(periodo.categorias[id])),
        moneda(periodo.total), moneda(periodo.acumulado),
      ]));
    tabla('Detalle de egresos', ['Fecha', 'Categoría', 'Proveedor', 'Comprobante', 'Orden', 'Importe'], [74, 112, 140, 250, 65, 91],
      reporte.movimientos.length ? reporte.movimientos.map(movimiento => [
        fecha(movimiento.fecha), nombreCategoria.get(movimiento.categoria) ?? movimiento.categoria,
        movimiento.proveedor, movimiento.detalle, movimiento.payment_order_id, moneda(movimiento.importe),
      ]) : [['', 'Sin egresos en el período', '', '', '', '']]);

    const paginas = doc.bufferedPageRange();
    for (let indice = 0; indice < paginas.count; indice++) {
      doc.switchToPage(indice);
      doc.font('Helvetica').fontSize(8).fillColor('#756f67').text(`Hotel Alejandro I · ${fecha(reporte.desde)} al ${fecha(reporte.hasta)} · Página ${indice + 1} de ${paginas.count}`, 36, doc.page.height - 30, { lineBreak: false });
    }
    doc.end();
  });
}

module.exports = { crearExcel, crearPdf };