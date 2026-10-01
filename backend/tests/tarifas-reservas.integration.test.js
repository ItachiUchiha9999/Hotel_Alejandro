const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Tarifas: edición, estado, auditoría y reservas sin desplazamiento de fechas', {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.match(url.pathname, /^\/hotel_s3_test_/);
  process.env.DATABASE_URL = url.toString();
  const p = require('../src/db/prisma');
  const tarifas = require('../src/modules/tarifas/tarifas.service');
  const reservas = require('../src/modules/reservas/reservas.service');
  try {
    const room = await p.room.findUnique({ where: { room_number: 'D12' } });
    assert.ok(room, 'Ejecutar en copia de la base DEMO');
    const from = '2032-03-10';
    const to = '2032-03-12';
    const rate = await tarifas.crear({ room_type_id: room.room_type_id, base_price: 100000, valid_from: from });
    const reserva = await reservas.crear({ guestId: 1, roomId: room.room_id, checkIn: from, checkOut: to, employeeId: 1 });
    assert.equal(reserva.check_in_date.toISOString().slice(0, 10), from);
    assert.equal(reserva.check_out_date.toISOString().slice(0, 10), to);
    assert.equal(Number(reserva.total_amount), 200000);
    await assert.rejects(() => reservas.crear({ guestId: 1, roomId: room.room_id, checkIn: '2032-03-11', checkOut: '2032-03-13', employeeId: 1 }), /ocupada/);
    const adjoining = await reservas.crear({ guestId: 1, roomId: room.room_id, checkIn: to, checkOut: '2032-03-14', employeeId: 1 });
    assert.equal(adjoining.check_in_date.toISOString().slice(0, 10), to);
    await tarifas.actualizar(rate.rate_id, { base_price: 120000, season_name: 'ALTA', reason: 'Prueba edición' });
    assert.equal(Number((await p.reservation.findUnique({ where: { reservation_id: reserva.reservation_id } })).total_amount), 200000);
    assert.equal((await tarifas.historial(rate.rate_id)).length, 1);
    await tarifas.actualizar(rate.rate_id, { active: false });
    const available = await p.$queryRaw`SELECT * FROM fn_available_rooms('2032-04-01'::date, '2032-04-03'::date)`;
    assert.ok(!available.some(r => r.room_id === room.room_id));
    await assert.rejects(() => reservas.crear({ guestId: 1, roomId: room.room_id, checkIn: '2032-04-01', checkOut: '2032-04-03', employeeId: 1 }), /tarifa vigente/);
    await tarifas.actualizar(rate.rate_id, { active: true });
    const newReservation = await reservas.crear({ guestId: 1, roomId: room.room_id, checkIn: '2032-04-01', checkOut: '2032-04-03', employeeId: 1 });
    assert.equal(Number(newReservation.total_amount), 240000);
    await assert.rejects(() => tarifas.actualizar(rate.rate_id, { base_price: 0 }), /mayor que cero/);
    await assert.rejects(() => tarifas.actualizar(rate.rate_id, { active: 'false' }), /verdadero o falso/);
    await assert.rejects(() => tarifas.actualizar(rate.rate_id, { valid_from: '2032-03-09' }), /período/);
    assert.equal((await tarifas.historial(rate.rate_id)).length, 3);
    const old = await p.room_type_rate.findFirst({ where: { valid_to: { lt: new Date() } } });
    if (old) await assert.rejects(() => tarifas.actualizar(old.rate_id, { base_price: 1 }), /finalizó/);
  } finally {
    await p.$disconnect();
  }
});
