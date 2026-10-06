const { test } = require('node:test');
const assert = require('node:assert/strict');
const { credenciales, cancelarPosible, calcularPenalidad, agruparPorTipo } = require('../src/modules/publico/publico.service');
const habitaciones = require('../src/modules/habitaciones/habitaciones.service');

test('consulta pública exige código y documento no vacíos y normaliza el código', () => {
  assert.deepEqual(credenciales(' ha-123 ', ' 001234 '), { code: 'HA-123', doc: '001234' });
  assert.throws(() => credenciales('', '001234'), /código y documento/);
  assert.throws(() => credenciales('HA-123', ''), /código y documento/);
  assert.throws(() => credenciales('X'.repeat(21), '001234'), /código y documento/);
});

test('cancelación pública solo permite reservas pendientes o confirmadas', () => {
  assert.equal(cancelarPosible('PENDIENTE'), true);
  assert.equal(cancelarPosible('CONFIRMADA'), true);
  for (const estado of ['IN_HOUSE', 'FINALIZADA', 'CANCELADA', 'NO_SHOW']) assert.equal(cancelarPosible(estado), false);
});

test('la penalidad respeta las horas gratuitas, el porcentaje y los centavos', () => {
  const ahora = new Date('2030-01-01T00:00:00Z');
  const policy = { free_cancel_hours: 24, penalty_percentage: 50 };
  assert.deepEqual(calcularPenalidad(policy, new Date('2030-01-02T00:00:00Z'), 10000, ahora), { porcentaje: 0, importe: 0 });
  assert.deepEqual(calcularPenalidad(policy, new Date('2030-01-01T12:00:00Z'), 10000, ahora), { porcentaje: 50, importe: 5000 });
  assert.deepEqual(calcularPenalidad({ ...policy, penalty_percentage: 33.33 }, new Date('2030-01-01T12:00:00Z'), 123.45, ahora), { porcentaje: 33.33, importe: 41.15 });
});

test('disponibilidad rechaza rangos de fechas y cantidad de huéspedes inválidos antes de consultar la base', async () => {
  const base = { desde: '2030-05-10', hasta: '2030-05-11', capacidadObligatoria: true };
  await assert.rejects(habitaciones.consultarDisponibilidad({ ...base, hasta: '2030-05-10', capacidad: '2' }), /posterior/);
  await assert.rejects(habitaciones.consultarDisponibilidad({ ...base, hasta: '2030-05-09', capacidad: '2' }), /posterior/);
  await assert.rejects(habitaciones.consultarDisponibilidad({ ...base, desde: '2030-02-30', capacidad: '2' }), /formato/);
  await assert.rejects(habitaciones.consultarDisponibilidad(base), /huéspedes/);
  await assert.rejects(habitaciones.consultarDisponibilidad({ ...base, capacidad: '0' }), /huéspedes/);
  await assert.rejects(habitaciones.consultarDisponibilidad({ ...base, capacidad: '1.5' }), /huéspedes/);
});

test('la disponibilidad web agrupa habitaciones físicas por tipo y no expone sus números', () => {
  const disponibles = [
    { room_id: 103, room_number: '103', room_type: { room_type_id: 1, room_type_name: 'Doble', room_type_description: 'Dos camas', room_type_max_capacity: 2 }, precio_por_noche: 50000, noches: 2, precio_total_estimado: 100000 },
    { room_id: 104, room_number: '104', room_type: { room_type_id: 1, room_type_name: 'Doble', room_type_description: 'Dos camas', room_type_max_capacity: 2 }, precio_por_noche: 50000, noches: 2, precio_total_estimado: 100000 },
    { room_id: 201, room_number: '201', room_type: { room_type_id: 2, room_type_name: 'Suite', room_type_description: null, room_type_max_capacity: 4 }, precio_por_noche: 80000, noches: 2, precio_total_estimado: 160000 },
  ];
  const grupos = agruparPorTipo(disponibles);
  assert.equal(grupos.length, 2);
  assert.deepEqual(grupos.map(({ tipo, cantidad_disponible }) => [tipo, cantidad_disponible]), [['Doble', 2], ['Suite', 1]]);
  assert.equal(grupos[0].habitacion_id, 103);
  assert.equal(Object.hasOwn(grupos[0], 'numero'), false);
});
