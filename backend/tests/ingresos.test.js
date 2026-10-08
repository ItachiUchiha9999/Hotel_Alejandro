const { test } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { validarFiltros, generarReporte } = require('../src/modules/ingresos/ingresos.reglas');
const { crearExcel, crearPdf } = require('../src/modules/ingresos/ingresos.exportar');
const cobro = (datos = {}) => ({ id: 'R-1', fecha: '2026-10-05', origen: 'RESERVAS', detalle: 'Alojamiento', reserva: 'HA-1', importe: '100.00', ...datos });

test('Ingresos: valida fechas reales, rango, agrupación y duración máxima', () => {
  for (const filtros of [{ desde:'2026-02-30' },{ desde:'2026-10-06',hasta:'2026-10-05' },{ agrupacion:'DIA' },{ desde:['2026-01-01'] },{ desde:'2000-01-01',hasta:'2026-01-01' }]) {
    assert.throws(() => validarFiltros(filtros), error => error.status === 400);
  }
  assert.equal(validarFiltros({ desde:'2024-02-29',hasta:'2024-02-29' }).dias,1);
});
test('Ingresos: el período anterior es contiguo y de igual duración, incluso en años bisiestos', () => {
  const filtros = validarFiltros({ desde:'2024-03-01',hasta:'2024-03-03' });
  assert.equal(filtros.anterior_desde,'2024-02-27'); assert.equal(filtros.anterior_hasta,'2024-02-29');
});
test('Ingresos: suma los tres orígenes en centavos y conserva el total al alternar Mes/Semana', () => {
  const filas = [cobro({ importe:'19.99',fecha:'2026-10-01' }),cobro({ id:'S-1',origen:'SERVICIOS',importe:'1.10' }),cobro({ id:'S-2',origen:'CONSUMOS',importe:'0.29' }),cobro({ fecha:'2026-09-30',importe:20 }),cobro({ fecha:'2026-10-06',importe:999 })];
  const base = { desde:'2026-10-01',hasta:'2026-10-05' };
  const mes = generarReporte(validarFiltros({ ...base,agrupacion:'MES' }),filas);
  const semana = generarReporte(validarFiltros({ ...base,agrupacion:'SEMANA' }),filas);
  assert.equal(mes.total,21.38); assert.equal(semana.total,mes.total);
  assert.equal(semana.serie[0].inicio,'2026-09-28'); assert.equal(semana.serie[0].desde,'2026-10-01');
  assert.equal(semana.serie[0].hasta,'2026-10-04'); assert.equal(semana.serie[1].hasta,'2026-10-05');
  assert.equal(semana.serie[1].acumulado,21.38); assert.equal(semana.movimientos.length,3);
  assert.equal(mes.comparacion.total,20); assert.ok(Math.abs(mes.comparacion.variacion_porcentual - 6.9) < 0.00001);
});
test('Ingresos: variación positiva, negativa y anterior en cero no producen Infinity ni NaN', () => {
  const filtros = validarFiltros({ desde:'2026-10-01',hasta:'2026-10-07' });
  const previo = cobro({ fecha:'2026-09-25',importe:100 });
  assert.equal(generarReporte(filtros,[previo,cobro({ importe:150 })]).comparacion.variacion_porcentual,50);
  assert.equal(generarReporte(filtros,[previo,cobro({ importe:50 })]).comparacion.variacion_porcentual,-50);
  assert.equal(generarReporte(filtros,[previo]).comparacion.variacion_porcentual,-100);
  assert.equal(generarReporte(filtros,[cobro()]).comparacion.variacion_porcentual,null);
  assert.equal(generarReporte(filtros,[]).comparacion.variacion_porcentual,0);
});
test('Ingresos: los meses sin datos figuran en cero y el rango no incluye cobros ajenos', () => {
  const reporte = generarReporte(validarFiltros({ desde:'2025-12-01',hasta:'2026-02-28' }),[cobro({ fecha:'2026-01-15' }),cobro({ fecha:'2026-03-01',importe:999 }),cobro({ origen:'OTRO',importe:999 })]);
  assert.deepEqual(reporte.serie.map(p => p.total),[0,100,0]); assert.equal(reporte.total,100);
});
test('Ingresos: Excel contiene el rango aplicado, agrupación, variación, serie y todos los cobros', async () => {
  const filtros = validarFiltros({ desde:'2026-10-01',hasta:'2026-10-08',agrupacion:'SEMANA' });
  const filas = Array.from({ length:25 },(_,i) => cobro({ id:`R-${i}`,importe:1.10 }));
  const reporte = generarReporte(filtros,[...filas,cobro({ fecha:'2026-09-25',importe:25 })]);
  const libro = new ExcelJS.Workbook(); await libro.xlsx.load(await crearExcel(reporte).xlsx.writeBuffer());
  const resumen = libro.getWorksheet('Resumen');
  assert.equal(resumen.getCell('B2').value,reporte.desde); assert.equal(resumen.getCell('B3').value,reporte.hasta);
  assert.equal(resumen.getCell('B4').value,'SEMANA'); assert.equal(resumen.getCell('B6').value,27.5);
  assert.equal(resumen.getCell('B9').value,25); assert.equal(resumen.getCell('B11').value,0.1);
  assert.equal(libro.getWorksheet('Línea de tiempo').getCell('G3').value,27.5);
  assert.equal(libro.getWorksheet('Cobros').rowCount,26);
});
test('Ingresos: PDF genera reportes extensos paginados y también períodos vacíos', async () => {
  const filtros = validarFiltros({ desde:'2026-01-01',hasta:'2026-12-31',agrupacion:'SEMANA' });
  for (const filas of [[],Array.from({ length:100 },(_,i) => cobro({ id:`R-${i}`,detalle:`Servicio ${i} con descripción extensa para probar el ajuste de texto` }))]) {
    const bytes = await crearPdf(generarReporte(filtros,filas));
    assert.equal(bytes.subarray(0,5).toString(),'%PDF-'); assert.match(bytes.toString('latin1'),/%%EOF/);
    assert.ok([...bytes.toString('latin1').matchAll(/\/Type \/Page\b/g)].length >= 2);
  }
});
