const { test } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { validarFiltros, generarReporte } = require('../src/modules/egresos/egresos.reglas');
const { crearExcel, crearPdf } = require('../src/modules/egresos/egresos.exportar');

const egreso = (datos = {}) => ({
  id: 'P-1',
  fecha: '2026-10-05',
  categoria: 'PROVEEDORES',
  detalle: 'Pago de comprobante',
  importe: '100.00',
  ...datos,
});

test('Egresos: valida fechas reales, rangos y agrupación', () => {
  for (const filtros of [
    { desde: '2026-02-30' },
    { desde: '2026-10-06', hasta: '2026-10-05' },
    { agrupacion: 'DIA' },
    { desde: ['2026-01-01'] },
    { desde: '2000-01-01', hasta: '2026-01-01' },
  ]) {
    assert.throws(() => validarFiltros(filtros), error => error.status === 400);
  }
});

test('Egresos: agrupa por mes o semana, acumula y el total no cambia', () => {
  const filas = [
    egreso({ id: 'P-1', importe: '20.10', fecha: '2026-10-01' }),
    egreso({ id: 'P-2', categoria: 'COMPRAS_STOCK', importe: '10.20', fecha: '2026-10-05' }),
    egreso({ id: 'P-3', categoria: 'GASTOS_OPERATIVOS', importe: '0.30', fecha: '2026-10-06' }),
    egreso({ id: 'P-4', importe: '99.00', fecha: '2026-09-30' }),
    egreso({ id: 'P-5', importe: '99.00', fecha: '2026-10-08' }),
  ];
  const filtros = { desde: '2026-10-01', hasta: '2026-10-07' };
  const mes = generarReporte(validarFiltros({ ...filtros, agrupacion: 'MES' }), filas);
  const semana = generarReporte(validarFiltros({ ...filtros, agrupacion: 'SEMANA' }), filas);

  assert.equal(mes.total, 30.6);
  assert.equal(semana.total, mes.total);
  assert.equal(semana.serie[0].inicio, '2026-09-28');
  assert.equal(semana.serie[1].acumulado, 30.6);
  assert.equal(mes.categoria_principal.id, 'PROVEEDORES');
  assert.equal(mes.categoria_principal.porcentaje, 20.1 / 30.6 * 100);
  assert.equal(mes.movimientos.length, 3);
});

test('Egresos: incluye períodos sin movimientos en cero y principal nula', () => {
  const reporte = generarReporte(
    validarFiltros({ desde: '2026-01-01', hasta: '2026-03-31' }),
    [egreso({ fecha: '2026-04-01' })],
  );
  assert.deepEqual(reporte.serie.map(periodo => periodo.total), [0, 0, 0]);
  assert.equal(reporte.total, 0);
  assert.equal(reporte.categoria_principal, null);
});

test('Egresos: Excel incluye resumen, porcentaje, períodos y movimientos; PDF es válido', async () => {
  const reporte = generarReporte(validarFiltros({ desde: '2026-10-01', hasta: '2026-10-07' }), [
    egreso({ importe: 80 }),
    egreso({ id: 'P-2', categoria: 'COMPRAS_STOCK', importe: 20 }),
  ]);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await crearExcel(reporte).xlsx.writeBuffer());
  assert.equal(libro.getWorksheet('Resumen').getCell('B5').value, 100);
  assert.equal(libro.getWorksheet('Resumen').getCell('B8').value, 0.8);
  assert.equal(libro.getWorksheet('Períodos').getCell('G2').value, 100);
  assert.equal(libro.getWorksheet('Egresos').rowCount, 3);

  const pdf = await crearPdf(reporte);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.match(pdf.toString('latin1'), /%%EOF/);
});