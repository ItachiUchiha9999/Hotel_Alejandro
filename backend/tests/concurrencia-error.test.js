const { test } = require('node:test');
const assert = require('node:assert/strict');
const errorHandler = require('../src/middlewares/errorHandler');

for (const error of [{ code: 'P2034' }, { code: 'P2010', meta: { code: '40001' } }, { code: 'P2010', meta: { code: '40P01' } }]) {
  test(`Concurrencia ${error.meta?.code ?? error.code}: responde 409 sin exponer SQL ni reintentar cobros`, () => {
    let status; let body;
    const res = { status(valor) { status = valor; return this; }, json(valor) { body = valor; } };
    errorHandler({ ...error, message: 'SQL interno de la transacción' }, {}, res, () => {});
    assert.equal(status, 409); assert.equal(body.ok, false);
    assert.match(body.message, /Actualizá la cuenta/);
    assert.equal(body.detalle, undefined); assert.ok(!body.message.includes('SQL'));
  });
}
