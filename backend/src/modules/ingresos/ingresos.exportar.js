const ExcelJS = require('exceljs');
const { PDFDocument } = require('pdfkit');
const moneda = valor => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(valor);
const fecha = valor => valor.split('-').reverse().join('/');
const variacion = reporte => reporte.comparacion.variacion_porcentual === null ? 'Sin base de comparación (período anterior en cero)'
  : `${reporte.comparacion.variacion_porcentual >= 0 ? '+' : ''}${reporte.comparacion.variacion_porcentual.toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`;
const nota = 'Ingresos cobrados en pesos argentinos, por fecha de cobro en Argentina. Incluye alojamiento, servicios y consumos pagados; no incluye reservas ni cargos pendientes de cobro. La comparación usa el rango inmediatamente anterior de igual duración.';

function crearExcel(reporte) {
  const libro = new ExcelJS.Workbook(); libro.creator = 'Hotel Alejandro I';
  const resumen = libro.addWorksheet('Resumen');
  resumen.columns = [{ width: 36 }, { width: 70 }];
  resumen.addRows([
    ['Hotel Alejandro I - Ingresos'], ['Desde', reporte.desde], ['Hasta', reporte.hasta],
    ['Agrupación', reporte.agrupacion], ['Moneda', reporte.moneda], ['Total del período', reporte.total],
    ['Período anterior desde', reporte.comparacion.desde], ['Período anterior hasta', reporte.comparacion.hasta],
    ['Total anterior', reporte.comparacion.total], ['Diferencia', reporte.comparacion.diferencia],
    ['Variación porcentual', reporte.comparacion.variacion_porcentual === null ? 'Sin base de comparación' : reporte.comparacion.variacion_porcentual / 100],
    ['Cantidad de cobros', reporte.cantidad_cobros], [], ['Origen', 'Importe'],
    ...reporte.origenes.map(o => [o.nombre, o.importe]), [], ['Criterio', nota],
  ]);
  for (const fila of [6, 9, 10, 15, 16, 17]) resumen.getCell(`B${fila}`).numFmt = '"$" #,##0.00';
  resumen.getCell('B11').numFmt = '0.00%'; resumen.getRow(19).alignment = { wrapText: true, vertical: 'top' }; resumen.getRow(19).height = 65;
  const serie = libro.addWorksheet('Línea de tiempo');
  serie.columns = [
    { header: 'Desde', key: 'desde', width: 16 }, { header: 'Hasta', key: 'hasta', width: 16 },
    { header: 'Reservas / alojamiento', key: 'RESERVAS', width: 27 }, { header: 'Servicios', key: 'SERVICIOS', width: 23 },
    { header: 'Consumos', key: 'CONSUMOS', width: 23 }, { header: 'Ingreso total', key: 'total', width: 23 }, { header: 'Acumulado', key: 'acumulado', width: 23 },
  ];
  for (const p of reporte.serie) serie.addRow({ desde: p.desde, hasta: p.hasta, ...p.origenes, total: p.total, acumulado: p.acumulado });
  for (let c = 3; c <= 7; c++) serie.getColumn(c).numFmt = '"$" #,##0.00';
  const detalle = libro.addWorksheet('Cobros');
  detalle.columns = [
    { header: 'Fecha', key: 'fecha', width: 16 }, { header: 'Origen', key: 'origen', width: 20 },
    { header: 'Reserva', key: 'reserva', width: 24 }, { header: 'Detalle', key: 'detalle', width: 45 },
    { header: 'Importe', key: 'importe', width: 23 },
  ];
  detalle.addRows(reporte.movimientos); detalle.getColumn('importe').numFmt = '"$" #,##0.00';
  for (const hoja of [resumen, serie, detalle]) {
    hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF302B25' } };
    hoja.views = [{ state: 'frozen', ySplit: 1 }];
  }
  for (const hoja of [serie, detalle]) hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, hoja.rowCount), column: hoja.columnCount } };
  return libro;
}

function crearPdf(reporte) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true,
      info: { Title: 'Ingresos - Hotel Alejandro I', Author: 'Hotel Alejandro I' } });
    const partes = []; doc.on('data', parte => partes.push(parte)); doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.font('Helvetica-Bold').fontSize(20).text('Hotel Alejandro I | Ingresos');
    doc.font('Helvetica').fontSize(10).text(`${fecha(reporte.desde)} al ${fecha(reporte.hasta)} · Agrupación: ${reporte.agrupacion === 'MES' ? 'Mes' : 'Semana'} · Moneda: ARS`);
    doc.moveDown().font('Helvetica-Bold').fontSize(14).text(`Total del período: ${moneda(reporte.total)}`);
    doc.font('Helvetica').fontSize(10).text(`Variación: ${variacion(reporte)}`);
    doc.text(`Anterior: ${fecha(reporte.comparacion.desde)} al ${fecha(reporte.comparacion.hasta)} · Total: ${moneda(reporte.comparacion.total)}`);
    doc.moveDown().fontSize(9).text(nota); doc.moveDown();
    // Gráfico vectorial con los mismos puntos y agrupación del reporte.
    const top = doc.y + 12; const x0 = 92; const x1 = 788; const y0 = top + 145;
    const maximo = Math.max(1, ...reporte.serie.map(p => p.total));
    for (const proporcion of [0, 0.5, 1]) {
      const y = y0 - proporcion * 130;
      doc.moveTo(x0, y).lineTo(x1, y).lineWidth(0.5).strokeColor('#ddd5c9').stroke();
      const compacto = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 }).format(maximo * proporcion);
      doc.fillColor('#756f67').fontSize(8).text(`$${compacto}`, 36, y - 4, { width: 48, align: 'right' });
    }
    const x = i => reporte.serie.length <= 1 ? (x0 + x1) / 2 : x0 + i / (reporte.serie.length - 1) * (x1 - x0);
    doc.lineWidth(2).strokeColor('#b8893f');
    reporte.serie.forEach((p,i) => { const y = y0 - p.total / maximo * 130; if (i === 0) doc.moveTo(x(i),y); else doc.lineTo(x(i),y); });
    doc.stroke();
    reporte.serie.forEach((p,i) => {
      doc.circle(x(i), y0 - p.total / maximo * 130, 2).fill('#b8893f');
      if (i === 0 || i === reporte.serie.length - 1 || i % Math.ceil(reporte.serie.length / 8) === 0) {
        doc.fillColor('#756f67').fontSize(7).text(fecha(p.desde), x(i) - 30, y0 + 8, { width: 60, align: 'center' });
      }
    });
    doc.y = y0 + 30; doc.x = 36;
    function tabla(titulo, encabezados, anchos, filas) {
      let y = doc.y + 12;
      function cabecera() {
        if (y > 440) { doc.addPage(); y = 36; }
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#302b25').text(titulo, 36, y); y = doc.y + 10;
        doc.rect(36, y, anchos.reduce((a,b) => a+b, 0), 24).fill('#302b25');
        let x = 36;
        encabezados.forEach((texto,i) => { doc.font('Helvetica-Bold').fontSize(8).fillColor('white').text(texto,x + 5,y + 7,{ width: anchos[i] - 10, lineBreak: false }); x += anchos[i]; }); y += 24;
      }
      cabecera();
      for (const fila of filas) {
        doc.font('Helvetica').fontSize(8);
        const alto = Math.max(24,...fila.map((texto,i) => doc.heightOfString(String(texto),{ width: anchos[i] - 10 }) + 12));
        if (y + alto > doc.page.height - 55) { doc.addPage(); y = 36; cabecera(); }
        let x = 36;
        fila.forEach((texto,i) => { doc.font('Helvetica').fontSize(8).fillColor('#302b25').text(String(texto),x + 5,y + 6,{ width: anchos[i] - 10 }); x += anchos[i]; });
        doc.moveTo(36,y + alto).lineTo(x,y + alto).strokeColor('#e8e0d4').lineWidth(0.5).stroke(); y += alto;
      }
      doc.y = y + 10; doc.x = 36;
    }
    tabla('Línea de tiempo', ['Período','Reservas / alojamiento','Servicios','Consumos','Ingreso total','Acumulado'], [160,120,120,120,120,120],
      reporte.serie.map(p => [`${fecha(p.desde)} - ${fecha(p.hasta)}`, ...['RESERVAS','SERVICIOS','CONSUMOS'].map(id => moneda(p.origenes[id])), moneda(p.total),moneda(p.acumulado)]));
    tabla('Detalle de cobros', ['Fecha','Origen','Reserva','Detalle','Importe'], [85,115,120,310,130],
      reporte.movimientos.length ? reporte.movimientos.map(m => [fecha(m.fecha),m.origen,m.reserva,m.detalle,moneda(m.importe)]) : [['Sin cobros en el período','','','','']]);
    const paginas = doc.bufferedPageRange();
    for (let i = 0; i < paginas.count; i++) {
      doc.switchToPage(i); doc.font('Helvetica').fontSize(8).fillColor('#756f67').text(`Hotel Alejandro I · ${fecha(reporte.desde)} al ${fecha(reporte.hasta)} · Página ${i + 1} de ${paginas.count}`,36,doc.page.height - 35,{ lineBreak: false });
    }
    doc.end();
  });
}

module.exports = { crearExcel, crearPdf };
