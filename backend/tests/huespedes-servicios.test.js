const { test } = require('node:test');
const assert = require('node:assert/strict');

// Sustituimos únicamente la conexión: estas pruebas no modifican la base local.
let db;
const prismaPath = require.resolve('../src/db/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true,
  exports: new Proxy({}, { get: (_target, key) => db[key] }) };
const servicios = require('../src/modules/servicios-habitacion/serviciosHabitacion.service');
const reservas = require('../src/modules/reservas/reservas.service');

function preparar({ estadias = [42], capacidad = 3, maxAdultos = 2 } = {}) {
  const cargos = [];
  const huespedes = [];
  const servicio = { service_id: 7, service_name: 'Lavandería', category: 'LAVANDERIA', current_price: 1500 };
  const reserva = { reservation_id: 42, room_id: 10, reservation_status: 'CONFIRMADA',
    check_in_date: new Date('2020-01-01T00:00:00Z'), adults: 1, children: 0,
    guest: { document_type: 'DNI', document_number: '111', first_name: 'Ana', last_name: 'Pérez' } };
  let ingresos = 0;
  db = {
    employees: { findUnique: async () => ({ employees_state: true }) },
    room: { findUnique: async () => ({ active: true, room_type: { room_type_max_capacity: capacidad, max_adults: maxAdultos } }) },
    reservation: { findUnique: async () => reserva },
    reservation_check_in: { create: async () => { ingresos++; reserva.reservation_status = 'IN_HOUSE'; } },
    $transaction: async (callback) => callback(db),
    $queryRaw: async (strings, ...values) => {
      const sql = strings.join('?');
      if (sql.includes('SELECT reservation_id FROM "reservation"')) {
        assert.equal(values[0], 10);
        return estadias.map((reservation_id) => ({ reservation_id }));
      }
      if (sql.includes('FROM "room_service_catalog"')) return [servicio];
      if (sql.includes('INSERT INTO "room_service_charge"')) {
        const [reservation_id, room_id, service_id, service_name, quantity, unit_price] = values;
        const cargo = { charge_id: cargos.length + 1, reservation_id, room_id, service_id,
          service_name, quantity, unit_price, total_amount: quantity * unit_price };
        cargos.push(cargo);
        return [cargo];
      }
      if (sql.includes('FROM "room_service_charge"')) {
        return cargos.filter((c) => c.room_id === values[0] && c.reservation_id === values[1]);
      }
      if (sql.includes('FROM "reservation_stay_guest"')) return huespedes;
      throw new Error(`Consulta no prevista: ${sql}`);
    },
    $executeRaw: async (strings, ...values) => {
      assert.match(strings.join('?'), /INSERT INTO "reservation_stay_guest"/);
      huespedes.push({ reservation_id: values[0], guest_role: values[1], person_type: values[2],
        document_type: values[3], document_number: values[4], first_name: values[5], last_name: values[6] });
      return 1;
    },
  };
  return { cargos, huespedes, servicio, get ingresos() { return ingresos; } };
}

test('Servicios: cargar y consultar por habitación sin enviar una reserva', async () => {
  preparar();
  const cargo = await servicios.cargarCargo(10, { serviceId: 7, quantity: 2 }, 1);
  assert.equal(cargo.room_id, 10);
  assert.equal(cargo.reservation_id, 42);
  assert.equal(cargo.total_amount, 3000);
  assert.deepEqual(await servicios.listarCargos(10), [cargo]);
});

test('Servicios: habitación sin estadía activa o con estadías ambiguas rechaza consumos', async () => {
  for (const estadias of [[], [42, 43]]) {
    const estado = preparar({ estadias });
    await assert.rejects(() => servicios.cargarCargo(10, { serviceId: 7 }, 1), { status: 409 });
    await assert.rejects(() => servicios.listarCargos(10), { status: 409 });
    assert.equal(estado.cargos.length, 0);
  }
});

test('Servicios: pantalla desactualizada no puede cargar al siguiente huésped', async () => {
  const estado = preparar({ estadias: [43] });
  await assert.rejects(() => servicios.cargarCargo(10, { serviceId: 7, expectedReservationId: 42 }, 1), /estadía.*cambió/);
  assert.equal(estado.cargos.length, 0);
  assert.equal((await servicios.cargarCargo(10, { serviceId: 7 }, 1)).reservation_id, 43);
});

test('Servicios: nueva ocupación de la misma habitación no hereda cargos anteriores', async () => {
  const estadias = [42];
  preparar({ estadias });
  await servicios.cargarCargo(10, { serviceId: 7 }, 1);
  estadias[0] = 43;
  assert.deepEqual(await servicios.listarCargos(10), []);
  const nuevo = await servicios.cargarCargo(10, { serviceId: 7 }, 1);
  assert.deepEqual(await servicios.listarCargos(10), [nuevo]);
  await assert.rejects(() => servicios.listarCargos(10, 42), { status: 409 });
});

test('Servicios: compatibilidad con clientes anteriores y validación de referencia', async () => {
  preparar();
  assert.equal((await servicios.cargarCargo(10, { serviceId: 7, reservationId: 42 }, 1)).reservation_id, 42);
  await assert.rejects(() => servicios.cargarCargo(10, { serviceId: 7, reservationId: 99 }, 1), { status: 409 });
  await assert.rejects(() => servicios.cargarCargo(10, { serviceId: 7, expectedReservationId: 'inválida' }, 1), { status: 400 });
});

test('Servicios: futuros consumos usan el nuevo precio y los anteriores lo conservan', async () => {
  const estado = preparar();
  const anterior = await servicios.cargarCargo(10, { serviceId: 7 }, 1);
  estado.servicio.current_price = 2000;
  const nuevo = await servicios.cargarCargo(10, { serviceId: 7 }, 1);
  assert.equal(anterior.unit_price, 1500);
  assert.equal(nuevo.unit_price, 2000);
});

const acompanante = { personType: 'MENOR', documentType: 'DNI', documentNumber: '222', firstName: 'Luis', lastName: 'Pérez' };

test('Ingreso: guarda titular y acompañante con las cantidades declaradas', async () => {
  const estado = preparar();
  const resultado = await reservas.checkIn(42, { employeeId: 1, actualAdults: 1, actualChildren: 1, guests: [acompanante] });
  assert.equal(estado.ingresos, 1);
  assert.equal(resultado.stay_guests.length, 2);
  assert.equal(resultado.stay_guests[0].guest_role, 'TITULAR');
  assert.equal(resultado.stay_guests[1].person_type, 'MENOR');
});

test('Ingreso: rechaza exceso de capacidad o de adultos antes de guardar', async () => {
  for (const limites of [{ capacidad: 1, maxAdultos: 2 }, { capacidad: 4, maxAdultos: 1 }]) {
    const estado = preparar(limites);
    await assert.rejects(() => reservas.checkIn(42, { employeeId: 1, actualAdults: 2, actualChildren: 0,
      guests: [{ ...acompanante, personType: 'ADULTO' }] }), /capacidad/);
    assert.equal(estado.ingresos, 0);
    assert.equal(estado.huespedes.length, 0);
  }
});

test('Ingreso: rechaza datos malformados, documentos duplicados y cantidades incompletas', async () => {
  for (const guests of [[null], [{ ...acompanante, documentNumber: 'x'.repeat(31) }],
    [{ ...acompanante, documentNumber: '111' }], []]) {
    const estado = preparar();
    await assert.rejects(() => reservas.checkIn(42, { employeeId: 1, actualAdults: 1, actualChildren: 1, guests }), { status: 400 });
    assert.equal(estado.ingresos, 0);
  }
});
