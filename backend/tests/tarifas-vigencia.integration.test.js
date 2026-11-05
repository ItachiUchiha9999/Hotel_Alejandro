const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Tarifas: fecha final inclusiva, límites, reservas e historial', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.match(url.pathname, /^\/hotel_s3_test_/);
  process.env.DATABASE_URL = url.toString();
  const p = require('../src/db/prisma');
  const tarifas = require('../src/modules/tarifas/tarifas.service');
  const reservas = require('../src/modules/reservas/reservas.service');
  try {
    const tipo = await p.room_type.create({ data: { room_type_name: 'VIGENCIA LIMITADA', room_type_max_capacity: 1 } });
    const room = await p.room.create({ data: { room_type_id: tipo.room_type_id, room_number: 'VIG-1' } });
    const base = { room_type_id: tipo.room_type_id, base_price: 10000, valid_from: '2032-01-01' };
    const inicial = await tarifas.crear(base);
    const antigua = await reservas.crear({ guestId: 1, roomId: room.room_id, checkIn: '2032-06-01', checkOut: '2032-06-03', employeeId: 1 });
    await t.test('Rechaza fecha final anterior al inicio y fecha imposible sin guardar', async () => {
      await assert.rejects(tarifas.crear({ ...base, valid_from: '2032-12-01', fecha_hasta: '2032-11-30' }), e => e.status === 400);
      await assert.rejects(tarifas.crear({ ...base, valid_from: '2032-12-01', fecha_hasta: '2032-12-32' }), e => e.status === 400);
      assert.equal(await p.room_type_rate.count({ where: { room_type_id: tipo.room_type_id } }), 1);
    });
    const limitada = await tarifas.crear({ ...base, base_price: 15000, valid_from: '2032-12-01', fecha_hasta: '2032-12-31' });
    await t.test('Guarda hasta 31/12 inclusive como límite exclusivo 1/1', () => {
      assert.equal(limitada.valid_from.toISOString().slice(0, 10), '2032-12-01');
      assert.equal(limitada.valid_to.toISOString().slice(0, 10), '2033-01-01');
    });
    await t.test('Cierra tarifa anterior sin cambiar el precio de reservas existentes', async () => {
      assert.equal((await tarifas.obtener(inicial.rate_id)).valid_to.toISOString().slice(0, 10), '2032-12-01');
      assert.equal(Number((await p.reservation.findUnique({ where: { reservation_id: antigua.reservation_id } })).total_amount), 20000);
    });
    await t.test('Acepta reservas que ingresan el último día de vigencia', async () => {
      const r = await reservas.crear({ guestId: 1, roomId: room.room_id, checkIn: '2032-12-31', checkOut: '2033-01-01', employeeId: 1 });
      assert.equal(Number(r.price_per_night), 15000); assert.equal(r.rate_id, limitada.rate_id);
    });
    await t.test('No ofrece esa tarifa para ingresos después de su finalización', async () => {
      await assert.rejects(reservas.crear({ guestId: 1, roomId: room.room_id, checkIn: '2033-01-01', checkOut: '2033-01-02', employeeId: 1 }), /tarifa vigente/);
    });
    await t.test('Rechaza solapamientos sin alterar la tarifa limitada', async () => {
      await assert.rejects(tarifas.crear({ ...base, valid_from: '2032-12-15', fecha_hasta: '2033-01-15' }), e => e.status === 409);
      assert.equal((await tarifas.obtener(limitada.rate_id)).valid_to.toISOString().slice(0, 10), '2033-01-01');
    });
    await t.test('Permite la siguiente tarifa desde el día posterior y admite vigencia abierta', async () => {
      const siguiente = await tarifas.crear({ ...base, valid_from: '2033-01-01', fecha_hasta: null });
      assert.equal(siguiente.valid_to, null);
      const r = await reservas.crear({ guestId: 1, roomId: room.room_id, checkIn: '2033-01-01', checkOut: '2033-01-02', employeeId: 1 });
      assert.equal(r.rate_id, siguiente.rate_id);
    });
    await t.test('Una tarifa de un solo día funciona también el 29 de febrero', async () => {
      const otro = await p.room_type.create({ data: { room_type_name: 'VIGENCIA UN DIA', room_type_max_capacity: 1 } });
      const r = await tarifas.crear({ room_type_id: otro.room_type_id, base_price: 10000, valid_from: '2032-02-29', fecha_hasta: '2032-02-29' });
      assert.equal(r.valid_to.toISOString().slice(0, 10), '2032-03-01');
    });
  } finally { await p.$disconnect(); }
});
