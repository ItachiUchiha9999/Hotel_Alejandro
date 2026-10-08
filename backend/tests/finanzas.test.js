const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calcularTotales, generarSerie } = require('../src/modules/dashboard/finanzas.reglas');
const ExcelJS = require('exceljs');
const { crearExcel, crearPdf } = require('../src/modules/dashboard/finanzas.exportar');

test('REP-03: resultado y margen se calculan en centavos', () => {
  const totales = calcularTotales([
    { tipo: 'INGRESO', importe: '100.10' },
    { tipo: 'INGRESO', importe: '40.20' },
    { tipo: 'EGRESO', importe: '120.30' },
  ]);
  assert.equal(totales.ingresos, 140.3);
  assert.equal(totales.egresos, 120.3);
  assert.equal(totales.neto, 20);
  assert.ok(Math.abs(totales.margen_porcentual - (20 / 140.3 * 100)) < 0.000001);
});

test('REP-03: la serie marca resultados negativos y completa fechas sin movimientos', () => {
  const serie = generarSerie(new Date('2026-10-05T00:00:00Z'), 3, [
    { fecha: '2026-10-05', tipo: 'INGRESO', importe: 20 },
    { fecha: '2026-10-05', tipo: 'EGRESO', importe: 25 },
    { fecha: '2026-10-07', tipo: 'INGRESO', importe: 50 },
  ]);
  assert.deepEqual(serie.map(dia => dia.fecha), ['2026-10-05', '2026-10-06', '2026-10-07']);
  assert.equal(serie[0].neto, -5);
  assert.equal(serie[0].margen_porcentual, -25);
  assert.equal(serie[1].neto, 0);
  assert.equal(serie[1].margen_porcentual, null);
  assert.equal(serie[2].neto, 50);
});

test('REP-03: el margen queda nulo cuando no hubo ingresos', () => {
  assert.equal(calcularTotales([{ tipo: 'EGRESO', importe: 10 }]).margen_porcentual, null);
});

test('REP-03: PDF y Excel respetan período, margen y días negativos', async () => {
  const serie = generarSerie(new Date('2026-10-05T00:00:00Z'), 2, [
    { fecha: '2026-10-05', tipo: 'INGRESO', importe: 20 },
    { fecha: '2026-10-05', tipo: 'EGRESO', importe: 25 },
    { fecha: '2026-10-06', tipo: 'INGRESO', importe: 50 },
  ]);
  const reporte = {
    periodo: 'SEMANA',
    desde: '2026-10-05',
    hasta: '2026-10-06',
    serie,
    totales: calcularTotales([
      { tipo: 'INGRESO', importe: 70 },
      { tipo: 'EGRESO', importe: 25 },
    ]),
    comparacion: { totales: calcularTotales([]) },
    movimientos: [
      { fecha: '2026-10-05', tipo: 'INGRESO', detalle: 'Alojamiento', importe: 20 },
      { fecha: '2026-10-05', tipo: 'EGRESO', detalle: 'Pago proveedor', importe: 25 },
    ],
  };
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await crearExcel(reporte).xlsx.writeBuffer());
  assert.equal(libro.getWorksheet('Resumen').getCell('B7').value, 45);
  assert.equal(libro.getWorksheet('Períodos').getCell('D2').value, -5);
  assert.equal(libro.getWorksheet('Períodos').getRow(2).font.color.argb, 'FFB3453C');
  assert.equal(libro.getWorksheet('Movimientos').rowCount, 3);

  const pdf = await crearPdf(reporte);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.match(pdf.toString('latin1'), /%%EOF/);
});