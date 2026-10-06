const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

test('ECO-02 integra clientes, reservas, reintentos, concurrencia, disponibilidad y cancelación', {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.match(url.pathname, /^\/hotel_eco2_test_/);
  process.env.DATABASE_URL = url.toString();
  const p = require('../src/db/prisma');
  const { crearReservaWeb } = require('../src/modules/publico/reservaWeb.service');
  const publico = require('../src/modules/publico/publico.service');
  try {
    const employee = await p.employees.findUnique({ where: { employees_id: 1 } });
    assert.ok(employee);
    const type = await p.room_type.create({ data: { room_type_name: `ECO2 ${randomUUID()}`, room_type_max_capacity: 2 } });
    await p.room_type_rate.create({ data: { room_type_id: type.room_type_id, base_price: 50000, valid_from: new Date('2034-01-01T00:00:00Z'), employees_id: 1 } });
    const room = await p.room.create({ data: { room_number: 'ECO2-1', room_type_id: type.room_type_id } });
    const base = { requestId: randomUUID(), nombre: 'Ana', apellido: 'Web', tipoDocumento: 'DNI', documento: 'ECO2-001',
      email: 'ana@example.com', telefono: '+54 387 1234567', desde: '2035-05-10', hasta: '2035-05-12',
      tipoId: type.room_type_id, huespedes: 2, precioEsperado: 50000 };
    const antes = await publico.disponibilidad({ desde: base.desde, hasta: base.hasta, huespedes: 2 });
    assert.ok(antes.habitaciones.some(h => h.tipo_id === type.room_type_id));
    const [a, b] = await Promise.all([crearReservaWeb(base), crearReservaWeb(base)]);
    assert.equal(a.codigo, b.codigo);
    assert.equal(a.total, 100000);
    assert.equal(a.estado, 'PENDIENTE');
    const saved = await p.reservation.findUnique({ where: { reservation_code: a.codigo } });
    assert.equal(saved.reservation_source, 'WEB');
    assert.equal(saved.adults, 2);
    assert.equal(saved.room_id, room.room_id);
    assert.equal(saved.check_in_date.toISOString().slice(0, 10), base.desde);
    assert.equal(await p.reservation.count({ where: { room_id: room.room_id } }), 1);
    assert.equal(await p.guest.count({ where: { document_number: base.documento } }), 1);
    const [job] = await p.$queryRaw`SELECT * FROM reservation_web_request WHERE reservation_id = ${saved.reservation_id}`;
    assert.equal(job.confirmation.email, base.email);
    assert.equal(job.email_sent_at, null);
    await assert.rejects(() => crearReservaWeb({ ...base, nombre: 'Otro' }), /otros datos/);
    const despues = await publico.disponibilidad({ desde: base.desde, hasta: base.hasta, huespedes: 2 });
    assert.ok(!despues.habitaciones.some(h => h.tipo_id === type.room_type_id));
    await assert.rejects(() => crearReservaWeb({ ...base, requestId: randomUUID(), documento: 'ECO2-ROLLBACK' }), /disponibilidad/);
    assert.equal(await p.guest.count({ where: { document_number: 'ECO2-ROLLBACK' } }), 0);
    await assert.rejects(() => crearReservaWeb({ ...base, requestId: randomUUID(), desde: '2035-06-01', hasta: '2035-06-03', precioEsperado: 49999 }), /tarifa cambió/);
    const asociada = await crearReservaWeb({ ...base, requestId: randomUUID(), nombre: 'Nombre enviado', email: 'otro@example.com', desde: '2035-05-12', hasta: '2035-05-14' });
    const linked = await p.reservation.findUnique({ where: { reservation_code: asociada.codigo } });
    assert.equal(linked.guest_id, saved.guest_id);
    const guest = await p.guest.findUnique({ where: { guest_id: saved.guest_id } });
    assert.equal(guest.first_name, 'Ana');
    assert.equal(guest.email, base.email);
    const consultada = await publico.consultarReserva(a.codigo, base.documento);
    assert.equal(consultada.estado, 'PENDIENTE');
    await publico.cancelarReserva(a.codigo, base.documento);
    const liberada = await publico.disponibilidad({ desde: base.desde, hasta: base.hasta, huespedes: 2 });
    assert.ok(liberada.habitaciones.some(h => h.tipo_id === type.room_type_id));
    const racing = await Promise.allSettled(['A', 'B'].map(s => crearReservaWeb({ ...base, requestId: randomUUID(), documento: `ECO2-RACE-${s}`, desde: '2035-07-01', hasta: '2035-07-03' })));
    assert.equal(racing.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(racing.filter(r => r.status === 'rejected').length, 1);
    assert.equal(await p.reservation.count({ where: { room_id: room.room_id, check_in_date: new Date('2035-07-01T00:00:00Z') } }), 1);
    // Capturador SMTP local: comprueba errores/reintentos y envío real del protocolo,
    // sin contactar proveedores ni destinatarios externos.
    const net = require('node:net');
    const env = require('../src/config/env');
    const { procesarCorreos } = require('../src/modules/publico/correoReserva.service');
    const original = Object.fromEntries(['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'].map(k => [k, env[k]]));
    let rechazar = true;
    const mensajes = [];
    const sockets = new Set();
    const smtp = net.createServer(socket => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      socket.write('220 localhost ECO2 test SMTP\r\n');
      let buffer = '', data = false, mensaje = '';
      socket.on('data', chunk => {
        buffer += chunk.toString();
        let corte;
        while ((corte = buffer.indexOf('\r\n')) >= 0) {
          const linea = buffer.slice(0, corte); buffer = buffer.slice(corte + 2);
          if (data) {
            if (linea === '.') { mensajes.push(mensaje); mensaje = ''; data = false; socket.write('250 queued\r\n'); }
            else mensaje += linea + '\r\n';
          } else if (/^(EHLO|HELO)/i.test(linea)) socket.write('250-localhost\r\n250 SIZE 1048576\r\n');
          else if (/^MAIL FROM/i.test(linea)) socket.write(rechazar ? '451 Temporary test failure\r\n' : '250 OK\r\n');
          else if (/^DATA/i.test(linea)) { data = true; socket.write('354 End with dot\r\n'); }
          else if (/^QUIT/i.test(linea)) socket.end('221 Bye\r\n');
          else socket.write('250 OK\r\n');
        }
      });
    });
    await new Promise(resolve => smtp.listen(0, '127.0.0.1', resolve));
    try {
      Object.assign(env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: smtp.address().port, SMTP_SECURE: false, SMTP_USER: '', SMTP_PASS: '', MAIL_FROM: 'hotel@example.test' });
      await procesarCorreos();
      const [fallido] = await p.$queryRaw`SELECT * FROM reservation_web_request WHERE reservation_id = ${saved.reservation_id}`;
      assert.equal(fallido.email_sent_at, null);
      assert.equal(fallido.email_attempts, 1);
      assert.ok(fallido.email_next_attempt > new Date());
      assert.equal(await p.reservation.count({ where: { reservation_code: a.codigo } }), 1);
      rechazar = false;
      await p.$executeRaw`UPDATE reservation_web_request SET email_next_attempt = CURRENT_TIMESTAMP`;
      await Promise.all([procesarCorreos(), procesarCorreos()]);
      const [enviado] = await p.$queryRaw`SELECT * FROM reservation_web_request WHERE reservation_id = ${saved.reservation_id}`;
      assert.ok(enviado.email_sent_at);
      assert.equal(enviado.email_attempts, 2);
      assert.equal(mensajes.filter(m => m.includes(a.codigo)).length, 1);
      const cantidadEnviada = mensajes.length;
      await procesarCorreos();
      assert.equal(mensajes.length, cantidadEnviada);
      assert.equal((await crearReservaWeb(base)).correo, 'ENVIADO');
    } finally {
      Object.assign(env, original);
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => smtp.close(resolve));
    }
  } finally { await p.$disconnect(); }
});
