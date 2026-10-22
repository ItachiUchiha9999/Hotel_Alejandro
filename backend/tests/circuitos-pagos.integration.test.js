const { test } = require('node:test');
const assert = require('node:assert/strict');

// Estos casos escriben datos: solo se habilitan contra una base aislada explícita.
test('Pagos: saldos, respuestas actualizadas y confirmaciones concurrentes', {
  skip: !process.env.TEST_DATABASE_URL,
}, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.match(url.pathname, /^\/hotel_s3_test_/);
  process.env.DATABASE_URL = url.toString();
  const p = require('../src/db/prisma');
  const pagos = require('../src/modules/ordenes-pago/ordenesPago.service');
  let secuencia = 0;
  const proveedor = await p.suppliers.create({ data: {
    supplier_legal_name: 'Proveedor de pruebas de pagos', supplier_cuit: '30-00000001-5',
  } });
  const factura = (importe = 100000) => p.supplier_voucher.create({ data: {
    supplier_id: proveedor.supplier_id, voucher_type_id: 1, voucher_point_of_sale: '9996',
    voucher_number: String(++secuencia), issue_date: new Date(), total_amount: importe, employees_id: 1,
  } });
  const orden = () => pagos.crear({ supplier_id: proveedor.supplier_id, payment_method_id: 1,
    payment_date: '2026-10-22', employees_id: 1 });
  const agregar = (op, f, importe) => pagos.agregarDetalle(op.payment_order_id, { voucher_id: f.voucher_id, applied_amount: importe });
  const conflicto = e => e.name === 'AppError' && e.status === 409;
  try {
    await t.test('Sobrepago y decimales inválidos se rechazan sin dejar renglones', async () => {
      const f = await factura(); const op = await orden();
      await assert.rejects(agregar(op, f, 100001), conflicto);
      await assert.rejects(agregar(op, f, 0.001), e => e.status === 400);
      assert.equal((await pagos.obtener(op.payment_order_id)).payment_order_detail.length, 0);
      // Un importe monetario válido no se rechaza por representación binaria.
      const actual = await agregar(op, f, 0.29);
      assert.equal(Number(actual.total_amount), 0.29);
    });
    await t.test('Confirmar devuelve la OP y la factura ya actualizadas', async () => {
      const f = await factura(); const op = await orden(); await agregar(op, f, 40000);
      const confirmada = await pagos.confirmar(op.payment_order_id);
      assert.equal(confirmada.payment_order_status, 1);
      assert.ok(confirmada.confirmed_date);
      assert.equal(Number(confirmada.payment_order_detail[0].supplier_voucher.paid_amount), 40000);
      await assert.rejects(pagos.confirmar(op.payment_order_id), conflicto);
      await assert.rejects(agregar(op, f, 1), conflicto);
    });
    await t.test('Dos confirmaciones simultáneas de la misma OP solo pagan una vez', async () => {
      const f = await factura(); const op = await orden(); await agregar(op, f, 40000);
      const resultados = await Promise.allSettled([pagos.confirmar(op.payment_order_id), pagos.confirmar(op.payment_order_id)]);
      assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 1);
      assert.ok(resultados.some(r => r.status === 'rejected' && conflicto(r.reason)));
      assert.equal(Number((await p.supplier_voucher.findUnique({ where: { voucher_id: f.voucher_id } })).paid_amount), 40000);
      assert.equal(await p.supplier_account_movement.count({ where: { payment_order_id: op.payment_order_id } }), 1);
    });
    await t.test('Una OP vieja revalida el saldo al confirmar', async () => {
      const f = await factura(); const a = await orden(); const b = await orden();
      await agregar(a, f, 70000); await agregar(b, f, 70000); await pagos.confirmar(a.payment_order_id);
      await assert.rejects(pagos.confirmar(b.payment_order_id), e => conflicto(e) && e.message.includes('30000.00'));
      assert.equal((await pagos.obtener(b.payment_order_id)).payment_order_status, 0);
      assert.equal(await p.supplier_account_movement.count({ where: { payment_order_id: b.payment_order_id } }), 0);
      assert.equal(Number((await p.supplier_voucher.findUnique({ where: { voucher_id: f.voucher_id } })).paid_amount), 70000);
    });
    await t.test('Dos OP simultáneas contra una factura no superan su saldo', async () => {
      const f = await factura(); const a = await orden(); const b = await orden();
      await agregar(a, f, 60000); await agregar(b, f, 60000);
      const resultados = await Promise.allSettled([pagos.confirmar(a.payment_order_id), pagos.confirmar(b.payment_order_id)]);
      assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 1);
      assert.ok(resultados.some(r => r.status === 'rejected' && conflicto(r.reason)));
      assert.equal(Number((await p.supplier_voucher.findUnique({ where: { voucher_id: f.voucher_id } })).paid_amount), 60000);
    });
    await t.test('Quitar detalle actualiza el total y no permite editar una confirmada', async () => {
      const f = await factura(); const op = await orden(); const conDetalle = await agregar(op, f, 1000);
      const sinDetalle = await pagos.quitarDetalle(op.payment_order_id, conDetalle.payment_order_detail[0].detail_id);
      assert.equal(Number(sinDetalle.total_amount), 0); assert.equal(sinDetalle.payment_order_detail.length, 0);
      await assert.rejects(pagos.confirmar(op.payment_order_id), e => e.status === 400);
      const nueva = await agregar(op, f, 1000); await pagos.confirmar(op.payment_order_id);
      await assert.rejects(pagos.quitarDetalle(op.payment_order_id, nueva.payment_order_detail[0].detail_id), conflicto);
    });
    await t.test('Validación de proveedor, referencias y fecha no devuelve 500', async () => {
      const ajeno = await p.suppliers.create({ data: { supplier_legal_name: 'Otro proveedor', supplier_cuit: '30-00000002-3' } });
      const f = await p.supplier_voucher.create({ data: { supplier_id: ajeno.supplier_id, voucher_type_id: 1,
        voucher_number: '123', issue_date: new Date(), total_amount: 1000, employees_id: 1 } });
      const op = await orden(); await assert.rejects(agregar(op, f, 1000), conflicto);
      await assert.rejects(pagos.crear({ supplier_id: proveedor.supplier_id, payment_method_id: 2,
        payment_date: '2026-10-22', employees_id: 1 }), e => e.status === 400);
      await assert.rejects(pagos.crear({ supplier_id: proveedor.supplier_id, payment_method_id: 1,
        payment_date: 'fecha inválida', employees_id: 1 }), e => e.status === 400);
    });
  } finally { await p.$disconnect(); }
});

test('Reserva: cobros concurrentes, servicios y check-out impactan una sola vez en reportes', {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.match(url.pathname, /^\/hotel_s3_test_/);
  process.env.DATABASE_URL = url.toString();
  const p = require('../src/db/prisma');
  const app = require('../src/app');
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let token;
  async function request(path, method = 'GET', body) {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, ...await r.json() };
  }
  async function ok(path, method, body) {
    const r = await request(path, method, body); assert.ok(r.ok, `${path}: ${r.status} ${r.message}`); return r.data;
  }
  try {
    const login = await ok('/auth/login', 'POST', { usuario: 'admin', contrasena: '1234' }); token = login.token;
    const ahora = new Date(); const hoy = ahora.toISOString().slice(0, 10);
    const manana = new Date(ahora.getTime() + 86400000).toISOString().slice(0, 10);
    const tipo = await p.room_type.create({ data: { room_type_name: 'CIRCUITO RESERVA', room_type_max_capacity: 1 } });
    await p.room_type_rate.create({ data: { room_type_id: tipo.room_type_id, base_price: 100000, valid_from: new Date(hoy + 'T00:00:00Z'), employees_id: 1 } });
    const room = await p.room.create({ data: { room_type_id: tipo.room_type_id, room_number: 'CIR-RES' } });
    const r = await ok('/reservas', 'POST', { nuevoCliente: { document_type: 'PASAPORTE', document_number: 'CIRCUITO-RES', first_name: 'Sofia', last_name: 'Rivas' }, habitacionId: room.room_id, fechaIngreso: hoy, fechaEgreso: manana, estadoInicial: 'CONFIRMADA' });
    const query = `desde=${hoy}&hasta=${hoy}&agrupacion=MES`;
    const antes = await ok('/ingresos?' + query);
    assert.equal((await request(`/reservas/${r.reservation_id}/pagos-alojamiento`, 'POST', { amount: 1, paymentMethodId: 1 })).status, 409);
    const entrada = await ok(`/reservas/${r.reservation_id}/checkin`, 'POST', {}); assert.equal(entrada.reservation_status, 'IN_HOUSE');
    const centavos = await request(`/reservas/${r.reservation_id}/pagos-alojamiento`, 'POST', { amount: 0.29, paymentMethodId: 1 });
    assert.equal(centavos.status, 201, 'Un pago válido de $0,29 debe aceptarse');
    let solicitudes;
    // Retener la fila obliga a que los dos cobros arranquen con el mismo saldo.
    await p.$transaction(async tx => {
      await tx.$queryRaw`SELECT reservation_id FROM reservation WHERE reservation_id = ${r.reservation_id} FOR UPDATE`;
      solicitudes = Promise.all([
        request(`/reservas/${r.reservation_id}/pagos-alojamiento`, 'POST', { amount: 60000, paymentMethodId: 1 }),
        request(`/reservas/${r.reservation_id}/pagos-alojamiento`, 'POST', { amount: 60000, paymentMethodId: 1 }),
      ]);
      let esperando = 0;
      for (let intento = 0; intento < 100; intento++) {
        const [actividad] = await p.$queryRaw`SELECT count(*)::int AS cantidad FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%reservation%'`;
        esperando = actividad.cantidad; if (esperando >= 2) break;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert.ok(esperando >= 2, 'Los dos cobros deben estar esperando el bloqueo');
    });
    const resultados = await solicitudes;
    assert.deepEqual(resultados.map(x => x.status).sort(), [201, 409]);
    const parcial = await ok(`/reservas/${r.reservation_id}/pagos-alojamiento`); assert.equal(parcial.abonado, 60000.29); assert.equal(parcial.saldo, 39999.71);
    const servicio = await ok('/servicios-habitacion/catalogo', 'POST', { service_name: 'Lavanderia circuito', category: 'LAVANDERIA', current_price: 8500 });
    const cargo = await ok(`/servicios-habitacion/habitaciones/${room.room_id}/cargos`, 'POST', { serviceId: servicio.service_id, expectedReservationId: r.reservation_id, quantity: 1 });
    assert.equal((await ok('/ingresos?' + query)).total - antes.total, 60000.29);
    const salida = await ok(`/reservas/${r.reservation_id}/checkout`, 'POST', { settleAccommodationBalance: true, cobrarServicios: true, paymentMethodId: 1, expectedAccommodationBalance: 39999.71, serviceChargeIds: [cargo.charge_id] });
    assert.equal(salida.reservation_status, 'FINALIZADA');
    const cuenta = await ok(`/reservas/${r.reservation_id}/cuenta`); assert.equal(cuenta.saldo_total, 0); assert.equal(cuenta.total_abonado, 108500);
    const reporte = await ok('/ingresos?' + query); assert.equal(reporte.total - antes.total, 108500);
    assert.equal(reporte.movimientos.filter(x => x.reserva === r.reservation_code).length, 4);
    const dashboard = await ok('/dashboard/finanzas?fecha=' + hoy);
    assert.equal(dashboard.serie.find(x => x.fecha === hoy).ingresos, reporte.total);
    assert.equal((await request(`/reservas/${r.reservation_id}/checkout`, 'POST', {})).status, 409);
    assert.equal((await request(`/servicios-habitacion/cargos/${cargo.charge_id}/cobrar`, 'PATCH', { paymentMethodId: 1 })).status, 409);
    const habitacion = await p.room.findUnique({ where: { room_id: room.room_id } }); assert.equal(habitacion.room_state, 'LIMPIEZA');
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await p.$disconnect();
  }
});
