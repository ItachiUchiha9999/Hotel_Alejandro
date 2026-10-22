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
test('Vista anual: agrupa doce meses en centavos y distingue pendientes de meses sin movimientos', () => {
  const { generarSerieAnual } = require('../src/modules/dashboard/finanzas.reglas');
  const filas = [
    { fecha: '2024-01-01', tipo: 'INGRESO', importe: 0.1 },
    { fecha: '2024-01-31', tipo: 'INGRESO', importe: 0.2 },
    { fecha: '2024-02-29', tipo: 'INGRESO', importe: 100 },
    { fecha: '2024-02-29', tipo: 'EGRESO', importe: 130 },
  ];
  const serie = generarSerieAnual(new Date('2024-01-01T00:00:00Z'), filas, '2024-10-22');
  assert.equal(serie.length, 12); assert.equal(serie[0].ingresos, 0.3);
  assert.equal(serie[1].neto, -30); assert.equal(serie[1].margen_porcentual, -30);
  assert.equal(serie[2].pendiente, false); assert.equal(serie[2].neto, 0);
  assert.equal(serie[10].pendiente, true); assert.equal(serie[11].pendiente, true);
  assert.equal(serie.reduce((s, m) => s + Math.round(m.ingresos * 100), 0), 10030);
});

test('Vista anual: años pasados sin datos son cero; futuros sin datos son pendientes', () => {
  const { generarSerieAnual } = require('../src/modules/dashboard/finanzas.reglas');
  assert.ok(generarSerieAnual(new Date('2025-01-01T00:00:00Z'), [], '2026-10-22').every(m => !m.pendiente && m.neto === 0));
  assert.ok(generarSerieAnual(new Date('2027-01-01T00:00:00Z'), [], '2026-10-22').every(m => m.pendiente));
});

test('Vista anual: exporta doce meses y marca pendientes en Excel y PDF', async () => {
  const { generarSerieAnual } = require('../src/modules/dashboard/finanzas.reglas');
  const movimientos = [{ fecha: '2026-10-22', tipo: 'INGRESO', detalle: 'Alojamiento', importe: 100 }];
  const reporte = { periodo: 'ANIO', desde: '2026-01-01', hasta: '2026-12-31',
    serie: generarSerieAnual(new Date('2026-01-01T00:00:00Z'), movimientos, '2026-10-22'),
    totales: calcularTotales(movimientos), comparacion: { totales: calcularTotales([]) }, movimientos };
  const libro = crearExcel(reporte); const hoja = libro.getWorksheet('Períodos');
  assert.equal(hoja.rowCount, 13); assert.match(String(hoja.getCell('A11').value), /octubre/);
  assert.equal(hoja.getCell('B11').value, 100); assert.equal(hoja.getCell('B12').value, 'Pendiente');
  assert.equal(libro.getWorksheet('Resumen').getCell('B5').value, 100);
  const pdf = await crearPdf(reporte); assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
});
