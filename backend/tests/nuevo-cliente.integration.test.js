const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Reserva con cliente nuevo: alta conjunta, duplicados y rollback', {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.match(url.pathname, /^\/hotel_s3_test_/);
  process.env.DATABASE_URL = url.toString();
  const p = require('../src/db/prisma');
  const service = require('../src/modules/reservas/reservas.service');
  try {
    const room = await p.room.findUnique({ where: { room_number: 'D01' } });
    const base = { roomId: room.room_id, checkIn: '2035-05-10', checkOut: '2035-05-12', employeeId: 1 };
    const newGuest = { first_name: '  Cliente  ', last_name: 'Prueba', document_type: 'pasaporte', document_number: ' test-nuevo-01 ', email: '', phone: '' };
    const created = await service.crear({ ...base, newGuest });
    const guest = await p.guest.findUnique({ where: { guest_id: created.guest_id } });
    assert.equal(guest.first_name, 'Cliente');
    assert.equal(guest.document_number, 'TEST-NUEVO-01');
    assert.equal(guest.email, null);
    assert.equal(created.check_in_date.toISOString().slice(0, 10), base.checkIn);
    await assert.rejects(() => service.crear({ ...base, newGuest }), /Ya existe/);
    await assert.rejects(() => service.crear({ ...base, guestId: guest.guest_id, newGuest }), /no ambos/);
    await assert.rejects(() => service.crear({ ...base, newGuest: { ...newGuest, first_name: ' ' } }), /nombre/);
    await assert.rejects(() => service.crear({ ...base, newGuest: { ...newGuest, email: 'invalido' } }), /correo/);
    await assert.rejects(() => service.crear({ ...base, newGuest: { ...newGuest, document_number: 'TEST-ROLLBACK-01' } }), /ocupada/);
    assert.equal(await p.guest.count({ where: { document_number: 'TEST-ROLLBACK-01' } }), 0);
    assert.equal(await p.guest.count({ where: { document_number: 'TEST-NUEVO-01' } }), 1);
    const existing = await service.crear({ ...base, guestId: guest.guest_id, checkIn: '2035-05-12', checkOut: '2035-05-14' });
    assert.equal(existing.guest_id, guest.guest_id);
    await p.guest.update({ where: { guest_id: guest.guest_id }, data: { guest_state: false } });
    await assert.rejects(() => service.crear({ ...base, newGuest }), /inactivo/);
    // La restricción única y la transacción también protegen dos altas simultáneas.
    const simultaneous = { ...newGuest, document_number: 'TEST-CONCURRENT-01' };
    const results = await Promise.allSettled([
      service.crear({ ...base, newGuest: simultaneous, checkIn: '2035-06-01', checkOut: '2035-06-03' }),
      service.crear({ ...base, newGuest: simultaneous, checkIn: '2035-06-04', checkOut: '2035-06-06' }),
    ]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    const rejected = results.find(r => r.status === 'rejected');
    assert.equal(rejected.reason.status, 409);
    assert.equal(await p.guest.count({ where: { document_number: simultaneous.document_number } }), 1);
  } finally { await p.$disconnect(); }
});
