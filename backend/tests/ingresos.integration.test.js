const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Ingresos: SQL integra cobros reales, excluye impagos y respeta medianoche argentina y comparación', {
  skip: !process.env.TEST_INGRESOS_DATABASE_URL,
}, async () => {
  const url = new URL(process.env.TEST_INGRESOS_DATABASE_URL);
  assert.match(url.pathname,/^\/hotel_ingresos_test_/);
  process.env.DATABASE_URL = url.toString();
  const p = require('../src/db/prisma');
  const service = require('../src/modules/ingresos/ingresos.service');
  let server;
  try {
    const type = await p.room_type.create({ data:{ room_type_name:'INGRESOS TEST',room_type_max_capacity:2 } });
    await p.room_type_rate.create({ data:{ room_type_id:type.room_type_id,base_price:100000,valid_from:new Date('2030-01-01T00:00:00Z'),employees_id:1 } });
    const room = await p.room.create({ data:{ room_number:'ING-1',room_type_id:type.room_type_id } });
    const r = await p.reservation.create({ data:{ reservation_code:'ING-TEST',guest_id:1,room_id:room.room_id,check_in_date:new Date('2032-10-01T00:00:00Z'),check_out_date:new Date('2032-10-08T00:00:00Z'),price_per_night:100000,employees_id:1 } });
    for (const [paid_at,amount] of [
      ['2032-09-24T03:00:00Z',50], ['2032-10-01T02:59:59Z',50],
      ['2032-10-01T03:00:00Z',100], ['2032-10-08T02:59:59Z',100], ['2032-10-08T03:00:00Z',999],
    ]) await p.reservation_payment.create({ data:{ reservation_id:r.reservation_id,payment_method_id:1,amount,paid_at:new Date(paid_at),employees_id:1 } });
    for (const [category,price,paid] of [['LAVANDERIA',25,true],['GASTRONOMIA',75,true],['OTROS',999,false]]) {
      const sc = await p.room_service_catalog.create({ data:{ category,service_name:`Test ${category}`,current_price:price,created_by:1 } });
      await p.room_service_charge.create({ data:{ reservation_id:r.reservation_id,room_id:room.room_id,service_id:sc.service_id,service_name:sc.service_name,unit_price:price,employees_id:1,
        ...(paid ? { paid_at:new Date('2032-10-05T15:00:00Z'),paid_by:1,payment_method_id:1 } : {}) } });
    }
    const filtros = { desde:'2032-10-01',hasta:'2032-10-07' };
    const mes = await service.consultar({ ...filtros,agrupacion:'MES' });
    const semana = await service.consultar({ ...filtros,agrupacion:'SEMANA' });
    assert.equal(mes.total,300); assert.equal(mes.comparacion.total,100);
    assert.equal(mes.comparacion.variacion_porcentual,200); assert.equal(mes.cantidad_cobros,4);
    assert.deepEqual(mes.origenes.map(o => o.importe),[200,25,75]);
    assert.equal(semana.total,300); assert.equal(semana.serie.at(-1).acumulado,300);
    assert.equal(mes.movimientos.filter(m => m.origen === 'RESERVAS').at(-1).fecha,'2032-10-01');
    const app = require('../src/app');
    server = await new Promise(resolve => { const s = app.listen(0,'127.0.0.1',() => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}/api/ingresos`;
    const query = new URLSearchParams({ ...filtros,agrupacion:'SEMANA' });
    const response = await fetch(`${base}?${query}`); assert.equal(response.status,200);
    assert.equal((await response.json()).data.total,300);
    assert.equal((await fetch(`${base}?desde=2032-02-30`)).status,400);
    assert.equal((await fetch(`${base}/exportar?${query}&formato=csv`)).status,400);
    for (const formato of ['pdf','xlsx']) {
      const download = await fetch(`${base}/exportar?${query}&formato=${formato}`);
      assert.equal(download.status,200); assert.match(download.headers.get('content-disposition'),/2032-10-01-2032-10-07-semana/);
      assert.ok((await download.arrayBuffer()).byteLength > 1000);
    }
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await p.$disconnect();
  }
});
