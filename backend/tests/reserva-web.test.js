const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { validarSolicitud } = require('../src/modules/publico/reservaWeb.service');
const { mensajeConfirmacion } = require('../src/modules/publico/correoReserva.service');
const solicitud = () => ({ requestId: randomUUID(), nombre: ' Ana ', apellido: ' Pérez ', tipoDocumento: 'dni',
  documento: ' 001234 ', email: ' ANA@EXAMPLE.COM ', telefono: '+54 387 1234567', desde: '2035-05-10',
  hasta: '2035-05-12', tipoId: 1, huespedes: 2, precioEsperado: 100000 });

test('ECO-02 valida y normaliza identidad y contacto sin perder ceros del documento', () => {
  const datos = validarSolicitud(solicitud());
  assert.equal(datos.documento, '001234');
  assert.equal(datos.email, 'ana@example.com');
  assert.equal(datos.nombre, 'Ana');
  assert.equal(datos.tipoDocumento, 'DNI');
});
test('ECO-02 rechaza contacto, fechas, capacidad e identificadores inválidos antes de acceder a la base', () => {
  for (const cambios of [{ nombre: '' }, { apellido: '' }, { documento: '' }, { email: 'sin-arroba' },
    { email: 'a@example.com,b@example.com' }, { telefono: '' }, { telefono: 'hola' },
    { desde: '2035-02-30' }, { hasta: '2035-05-10' }, { desde: '2000-01-01' },
    { huespedes: 0 }, { huespedes: 1.5 }, { huespedes: 21 }, { tipoId: -1 }, { requestId: 'x' },
    { precioEsperado: 0 }, { tipoDocumento: 'OTRO' }]) {
    assert.throws(() => validarSolicitud({ ...solicitud(), ...cambios }), { name: 'AppError', status: 400 });
  }
  assert.throws(() => validarSolicitud(null), { name: 'AppError' });
});
test('ECO-02 el correo incluye código, estadía, precio, estado pendiente y pago en el hotel', () => {
  const msg = mensajeConfirmacion({ nombre: 'Ana', apellido: 'Pérez', email: 'ana@example.com',
    codigo: 'HA-2035-001', tipo: 'Doble', desde: '2035-05-10', hasta: '2035-05-12',
    huespedes: 2, noches: 2, moneda: 'ARS', total: 200000, vence: '2035-05-09T12:00:00Z' });
  assert.equal(msg.to.address, 'ana@example.com');
  for (const dato of ['HA-2035-001', '2035-05-10', '2035-05-12', 'Doble', 'Huéspedes: 2', 'Pendiente', 'pago se realiza en el hotel', '/web/consulta']) assert.ok(msg.text.includes(dato));
  assert.equal(msg.disableFileAccess, true);
});
