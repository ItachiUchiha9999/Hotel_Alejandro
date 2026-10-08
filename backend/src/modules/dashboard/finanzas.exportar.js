const ExcelJS = require('exceljs');
const { PDFDocument } = require('pdfkit');

const moneda = valor => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(valor);
const fecha = valor => valor.split('-').reverse().join('/');
const porcentaje = valor => valor === null ? 'Sin ingresos' : `${valor.toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`;

function crearExcel(reporte) {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Hotel Alejandro I';
  const resumen = libro.addWorksheet('Resumen');
  resumen.columns = [{ width: 34 }, { width: 42 }];
  resumen.addRows([
    ['Hotel Alejandro I - Rentabilidad'],
    ['Período', reporte.periodo],
    ['Desde', reporte.desde],
    ['Hasta', reporte.hasta],
    ['Ingresos', reporte.totales.ingresos],
    ['Egresos', reporte.totales.egresos],
    ['Resultado (ingresos - egresos)', reporte.totales.neto],
    ['Margen porcentual', reporte.totales.margen_porcentual === null ? 'Sin ingresos' : reporte.totales.margen_porcentual / 100],
    ['Resultado período anterior', reporte.comparacion.totales.neto],
  ]);
  for (const fila of [5, 6, 7, 9]) resumen.getCell(`B${fila}`).numFmt = '"$" #,##0.00';
  resumen.getCell('B8').numFmt = '0.00%';

  const serie = libro.addWorksheet('Períodos');
  serie.columns = [
    { header: 'Fecha', key: 'fecha', width: 16 },
    { header: 'Ingresos', key: 'ingresos', width: 22 },
    { header: 'Egresos', key: 'egresos', width: 22 },
    { header: 'Resultado', key: 'neto', width: 22 },
    { header: 'Margen', key: 'margen', width: 16 },
  ];
  for (const punto of reporte.serie) {
    serie.addRow({ ...punto, margen: punto.margen_porcentual === null ? 'Sin ingresos' : punto.margen_porcentual / 100 });
    const fila = serie.lastRow;
    if (punto.neto < 0) fila.font = { color: { argb: 'FFB3453C' } };
  }
  for (const columna of ['ingresos', 'egresos', 'neto']) serie.getColumn(columna).numFmt = '"$" #,##0.00';
  serie.getColumn('margen').numFmt = '0.00%';

  const movimientos = libro.addWorksheet('Movimientos');
  movimientos.columns = [
    { header: 'Fecha', key: 'fecha', width: 16 },
    { header: 'Tipo', key: 'tipo', width: 14 },
    { header: 'Detalle', key: 'detalle', width: 65 },
    { header: 'Importe', key: 'importe', width: 22 },
  ];
  movimientos.addRows(reporte.movimientos);
  movimientos.getColumn('importe').numFmt = '"$" #,##0.00';

  for (const hoja of [resumen, serie, movimientos]) {
    hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF302B25' } };
    hoja.views = [{ state: 'frozen', ySplit: 1 }];
  }
  for (const hoja of [serie, movimientos]) {
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, hoja.rowCount), column: hoja.columnCount } };
  }
  return libro;
}

function crearPdf(reporte) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true,
      info: { Title: 'Rentabilidad - Hotel Alejandro I', Author: 'Hotel Alejandro I' } });
    const partes = [];
    doc.on('data', parte => partes.push(parte));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(partes)));

    doc.font('Helvetica-Bold').fontSize(20).fillColor('#302b25').text('Hotel Alejandro I | Rentabilidad');
    doc.font('Helvetica').fontSize(10).text(`${reporte.periodo === 'MES' ? 'Mes' : 'Semana'} · ${fecha(reporte.desde)} al ${fecha(reporte.hasta)}`);
    doc.moveDown().font('Helvetica-Bold').fontSize(13).text(`Ingresos: ${moneda(reporte.totales.ingresos)}    Egresos: ${moneda(reporte.totales.egresos)}`);
    doc.text(`Resultado: ${moneda(reporte.totales.neto)}    Margen: ${porcentaje(reporte.totales.margen_porcentual)}`);
    doc.moveDown().font('Helvetica').fontSize(9).text('Los períodos con resultado negativo se resaltan en rojo. Los egresos corresponden a órdenes de pago confirmadas.');

    const encabezados = ['Fecha', 'Ingresos', 'Egresos', 'Resultado', 'Margen'];
    const anchos = [150, 150, 150, 150, 150];
    let y = doc.y + 12;
    const cabecera = () => {
      doc.rect(36, y, 750, 22).fill('#302b25');
      let x = 36;
      encabezados.forEach((texto, indice) => {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('white').text(texto, x + 5, y + 6, { width: anchos[indice] - 10 });
        x += anchos[indice];
      });
      y += 22;
    };
    cabecera();
    for (const punto of reporte.serie) {
      if (y > doc.page.height - 48) { doc.addPage(); y = 36; cabecera(); }
      const valores = [fecha(punto.fecha), moneda(punto.ingresos), moneda(punto.egresos), moneda(punto.neto), porcentaje(punto.margen_porcentual)];
      let x = 36;
      valores.forEach((valor, indice) => {
        doc.font('Helvetica').fontSize(9).fillColor(punto.neto < 0 ? '#b3453c' : '#302b25').text(valor, x + 5, y + 6, { width: anchos[indice] - 10 });
        x += anchos[indice];
      });
      y += 22;
    }

    const paginas = doc.bufferedPageRange();
    for (let indice = 0; indice < paginas.count; indice++) {
      doc.switchToPage(indice);
      doc.font('Helvetica').fontSize(8).fillColor('#756f67').text(`Hotel Alejandro I · ${fecha(reporte.desde)} al ${fecha(reporte.hasta)} · Página ${indice + 1} de ${paginas.count}`, 36, doc.page.height - 30, { lineBreak: false });
    }
    doc.end();
  });
}

module.exports = { crearExcel, crearPdf };