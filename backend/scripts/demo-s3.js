// Ejecutar desde backend: node scripts/demo-s3.js
// Solo agrega datos ficticios a la base local S3; conserva un registro para no duplicarlos.
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const p = require('../src/db/prisma');
const service = (dir, name) => require(`../src/modules/${dir}/${name}.service`);
const reservas = service('reservas', 'reservas');
const stock = service('stock', 'stock');
const vouchers = service('comprobantes', 'comprobantes');
const pagos = service('ordenes-pago', 'ordenesPago');
const compras = service('ordenes-compra', 'ordenesCompra');
const hk = service('housekeeping', 'housekeeping');
const servicios = service('servicios-habitacion', 'serviciosHabitacion');
const ledger = path.join(__dirname, '../demo-s3.log');
const state = fs.existsSync(ledger) ? JSON.parse(fs.readFileSync(ledger, 'utf8')) : {};
async function step(key, fn) {
  if (Object.hasOwn(state, key)) return state[key];
  const result = await fn();
  state[key] = JSON.parse(JSON.stringify(result ?? true));
  fs.writeFileSync(ledger, JSON.stringify(state, null, 2));
  console.log('OK', key);
  return state[key];
}
async function main() {
  const url = new URL(process.env.DATABASE_URL);
  if (url.hostname !== 'localhost' || url.pathname !== '/sistema_hotelero_s3_local') throw Error('Este script solo admite la base local S3 de demostracion.');
  await step('backup', async () => {
    const destination = path.join(__dirname, '../antes-demo-s3.backup');
    const r = cp.spawnSync('C:/Program Files/PostgreSQL/17/bin/pg_dump.exe', [
      '-h', url.hostname, '-p', url.port || '5432', '-U', decodeURIComponent(url.username),
      '-d', url.pathname.slice(1), '-Fc', '-f', destination,
    ], { env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) }, encoding: 'utf8' });
    if (r.status !== 0) throw Error(r.stderr);
    return destination;
  });
  const today = await step('fecha', async () => (await p.$queryRaw`SELECT CURRENT_DATE::text AS fecha`)[0].fecha);
  const day = (n) => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const employeeId = 1;
  const types = await p.room_type.findMany({ orderBy: { room_type_id: 'asc' } });
  const rooms = {};
  for (let i = 1; i <= 12; i++) {
    rooms[i] = await step('habitacion-' + i, () => p.room.create({ data: {
      room_number: 'D' + String(i).padStart(2, '0'), room_type_id: types[(i - 1) % types.length].room_type_id,
      floor_number: 4, view_type: 'Ciudad', observations: 'DEMO: habitacion para pruebas',
    } }));
  }
  const guests = [];
  for (const [i, name] of ['Lucia', 'Mateo', 'Sofia', 'Nicolas', 'Emma', 'Bruno', 'Valentina', 'Oliver'].entries()) {
    guests.push(await step('huesped-' + i, () => p.guest.create({ data: {
      document_type: 'PASAPORTE', document_number: 'DEMO-S3-' + (i + 1), first_name: name, last_name: 'Demo',
      email: `demo${i + 1}@example.com`, nationality: i === 7 ? 'Italia' : 'Argentina', observations: 'Datos ficticios para pruebas',
    } })));
  }
  const res = {};
  const scenarios = [
    ['llegada-hoy', 1, 0, 2, 'CONFIRMADA', 1, 0],
    ['pendiente', 2, 2, 5, 'PENDIENTE', 2, 0],
    ['ocupada', 3, 0, 3, 'CONFIRMADA', 1, 0],
    ['finalizada', 4, 0, 1, 'CONFIRMADA', 1, 0],
    ['cancelada', 5, 5, 7, 'CONFIRMADA', 1, 0],
    ['familia', 8, 7, 10, 'CONFIRMADA', 2, 1],
    ['ocupada-pagada', 11, 0, 2, 'CONFIRMADA', 1, 0],
  ];
  for (const [i, [name, room, start, end, status, adults, children]] of scenarios.entries()) {
    res[name] = await step('reserva-' + name, async () => {
      const r = await reservas.crear({ guestId: guests[i].guest_id, roomId: rooms[room].room_id,
        checkIn: day(start), checkOut: day(end), status, employeeId, adults, children });
      return p.reservation.update({ where: { reservation_id: r.reservation_id }, data: {
        observations: 'DEMO: ' + name,
        check_in_date: new Date(day(start) + 'T00:00:00Z'), check_out_date: new Date(day(end) + 'T00:00:00Z'),
      } });
    });
  }
  // Normaliza tambien cargas anteriores: el alta por SQL del servicio convierte
  // medianoche UTC a la zona local y puede desplazar un dia los campos DATE.
  await step('fechas-demo-normalizadas', async () => {
    for (const [name, , start, end] of scenarios) {
      const current = await p.reservation.findUnique({ where: { reservation_id: res[name].reservation_id } });
      if (['FINALIZADA', 'CANCELADA', 'NO_SHOW'].includes(current.reservation_status)) continue;
      await p.reservation.update({
      where: { reservation_id: res[name].reservation_id }, data: {
        check_in_date: new Date(day(start) + 'T00:00:00Z'), check_out_date: new Date(day(end) + 'T00:00:00Z'),
      },
      });
    }
    return true;
  });
  for (const name of ['ocupada', 'finalizada', 'ocupada-pagada']) {
    await step('checkin-' + name, () => reservas.checkIn(res[name].reservation_id, { employeeId }));
  }
  await step('cancelacion', () => reservas.cancelar(res.cancelada.reservation_id, 'DEMO: cambio de planes', employeeId));
  for (const name of ['ocupada', 'ocupada-pagada', 'finalizada']) {
    await step('alojamiento-' + name, () => reservas.registrarPagoAlojamiento(res[name].reservation_id, {
      amount: name === 'ocupada' ? 50000 : Number(res[name].total_amount), paymentMethodId: name === 'ocupada' ? 2 : 1,
      paymentReference: name === 'ocupada' ? 'DEMO-TRANSFER-001' : undefined, employeeId,
    }));
  }
  await step('checkout', () => reservas.checkOut(res.finalizada.reservation_id, { employeeId, observations: 'DEMO: estadia finalizada y pagada' }));
  for (const [room, type, start, end, reason] of [
    [6, 'MANTENIMIENTO', 0, 2, 'Reparacion de aire acondicionado'],
    [7, 'FUERA_DE_SERVICIO', 0, 7, 'Renovacion de bano'],
    [9, 'MANTENIMIENTO', 10, 12, 'Pintura programada'],
    [10, 'LIMPIEZA', 0, 0, 'Limpieza diaria'],
  ]) await step('bloqueo-' + room, () => hk.abrir({ room_id: rooms[room].room_id, maintenance_type: type,
    start_date: day(start), estimated_end_date: day(end), reason: 'DEMO: ' + reason }));
  const deposit = await step('deposito', () => p.deposit.create({ data: { deposit_name: 'DEMO - Insumos de prueba', deposit_location: 'Sector de demostracion' } }));
  await step('deposito-inactivo', () => p.deposit.create({ data: { deposit_name: 'DEMO - Deposito inactivo', deposit_state: false } }));
  const category = await p.categories.findFirst();
  const articles = [];
  for (const [i, name] of ['Agua minibar', 'Toallas', 'Sin existencias', 'Articulo discontinuado'].entries()) {
    articles.push(await step('articulo-' + i, () => p.articles.create({ data: {
      category_id: category.category_id, article_code: 'DEMO-00' + (i + 1), article_name: 'DEMO - ' + name,
      article_stock_min_general: i === 1 ? 20 : 10, article_state: i !== 3,
    } })));
  }
  const move = (type, amount, article, origin, destination, note) => stock.crearMovimiento({
    movement_type: type, details: [{ article_code: articles[article].article_code, amount }],
    deposit_origin_id: origin, deposit_destination_id: destination, observations: 'DEMO: ' + note,
  });
  for (const [type, amount, article, origin, destination, note] of [
    ['INGRESO', 100, 0, null, deposit.deposit_id, 'compra inicial agua'],
    ['INGRESO', 8, 1, null, deposit.deposit_id, 'stock bajo de toallas'],
    ['EGRESO', 5, 0, deposit.deposit_id, null, 'salida de agua'],
    ['CONSUMO', 3, 0, deposit.deposit_id, null, 'consumo interno'],
    ['TRANSFERENCIA', 10, 0, deposit.deposit_id, 1, 'traslado a central'],
    ['AJUSTE_POSITIVO', 2, 0, null, deposit.deposit_id, 'sobrante inventario'],
    ['AJUSTE_NEGATIVO', 1, 0, deposit.deposit_id, null, 'rotura inventario'],
  ]) await step('movimiento-' + note, () => move(type, amount, article, origin, destination, note));
  await step('stock-cero', () => p.articles_deposit_stock.create({ data: { article_id: articles[2].article_id, deposit_id: deposit.deposit_id, stock_amount: 0 } }));
  const catalog = [];
  for (const [i, category] of ['MINIBAR', 'GASTRONOMIA', 'LAVANDERIA', 'ESTACIONAMIENTO', 'LIMPIEZA', 'TRANSPORTE', 'OTROS'].entries()) {
    catalog.push(await step('servicio-' + category, () => servicios.guardarCatalogo({ category, service_name: 'DEMO - ' + category,
      current_price: 2500 * (i + 1), ...(i === 0 ? { inventory_article_id: articles[0].article_id, inventory_deposit_id: deposit.deposit_id } : {}) }, employeeId)));
  }
  const cargo = await step('cargo-minibar', () => servicios.cargarCargo(rooms[3].room_id, { reservationId: res.ocupada.reservation_id, serviceId: catalog[0].service_id, quantity: 2 }, employeeId));
  await step('cargo-lavanderia', () => servicios.cargarCargo(rooms[3].room_id, { reservationId: res.ocupada.reservation_id, serviceId: catalog[2].service_id, quantity: 1 }, employeeId));
  await step('cargo-pagado', () => servicios.cobrarCargo(cargo.charge_id, { paymentMethodId: 1 }, employeeId));
  // Proveedores ficticios: CUIT con digito verificador valido; sin contactos reales.
  function cuit(base) { const weights = [5,4,3,2,7,6,5,4,3,2]; let n = 11 - [...base].reduce((s, v, i) => s + Number(v) * weights[i], 0) % 11; n = n === 11 ? 0 : n === 10 ? 9 : n; return base.slice(0,2) + '-' + base.slice(2) + '-' + n; }
  const supplier = await step('proveedor', () => p.suppliers.create({ data: { supplier_legal_name: 'DEMO Suministros Hotel S.A.', supplier_trade_name: 'DEMO Suministros', supplier_cuit: cuit('3099999901'), supplier_email: 'suministros@example.com', tax_condition_id: 1 } }));
  await step('proveedor-inactivo', () => p.suppliers.create({ data: { supplier_legal_name: 'DEMO Proveedor Inactivo', supplier_cuit: cuit('3099999902'), supplier_state: false } }));
  const allTypes = await p.voucher_type.findMany({ orderBy: { voucher_type_id: 'asc' } });
  const comprobantes = [];
  for (const [i, type] of allTypes.entries()) comprobantes.push(await step('comprobante-' + type.voucher_type, () => vouchers.crear({
    supplier_id: supplier.supplier_id, voucher_type_id: type.voucher_type_id, voucher_point_of_sale: '0099', voucher_number: String(900001 + i),
    issue_date: day(-10), due_date: day(i === 0 ? -2 : 15), total_amount: i === 4 ? 5000 : 100000 + i * 10000,
    observations: 'DEMO: ' + type.description,
  })));
  for (const [i, name] of ['parcial', 'total', 'borrador'].entries()) {
    const order = await step('pago-' + name, () => pagos.crear({ supplier_id: supplier.supplier_id, payment_method_id: i + 1,
      payment_date: today, payment_reference: i ? 'DEMO-REF-' + i : undefined, observations: 'DEMO: pago ' + name }));
    await step('detalle-pago-' + name, () => pagos.agregarDetalle(order.payment_order_id, { voucher_id: comprobantes[i].voucher_id, applied_amount: i === 0 ? 30000 : Number(comprobantes[i].total_amount) }));
    if (i < 2) await step('confirmacion-pago-' + name, () => pagos.confirmar(order.payment_order_id));
  }
  for (const status of ['BORRADOR', 'EMITIDA', 'APROBADA', 'RECIBIDA', 'CANCELADA']) {
    const order = await step('compra-' + status, () => compras.crear({ supplier_id: supplier.supplier_id, issue_date: today,
      expected_date: day(7), observations: 'DEMO: compra ' + status, details: [{ article_id: articles[1].article_id, quantity: 20, unit_price: 3500 }] }));
    if (status !== 'BORRADOR') await step('estado-compra-' + status, () => compras.cambiarEstado(order.purchase_order_id, { estado: status }));
  }
  const closed = await step('mantenimiento-a-cerrar', () => hk.abrir({ room_id: rooms[12].room_id,
    maintenance_type: 'MANTENIMIENTO', start_date: today, estimated_end_date: today, reason: 'DEMO: revision preventiva' }));
  await step('mantenimiento-cerrado', () => hk.finalizar(closed.maintenance_id, { closing_notes: 'DEMO: revision terminada' }));
  const tarifas = service('tarifas', 'tarifas');
  for (const [i, season] of ['ALTA', 'BAJA', 'ESPECIAL'].entries()) {
    await step('tarifa-' + season, () => tarifas.crear({ room_type_id: types[0].room_type_id,
      base_price: [60000, 40000, 75000][i], valid_from: day(30 + i * 30), season_name: season,
      reason: 'DEMO: temporada ' + season }, employeeId));
  }
  console.log('Carga DEMO completa. Fecha base:', today);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => p.$disconnect());
