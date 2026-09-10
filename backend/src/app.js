const express = require('express');
const cors = require('cors');
const ordenesCompraRoutes =
  require('./modules/ordenes-compra/ordenesCompra.routes');
const env = require('./config/env');
const errorHandler = require('./middlewares/errorHandler');
const notFound = require('./middlewares/notFound');

const depositosRoutes = require('./modules/depositos/depositos.routes');
const articulosRoutes = require('./modules/articulos/articulos.routes');
const categoriasRoutes = require('./modules/categorias/categorias.routes');
const stockRoutes = require('./modules/stock/stock.routes');
const tiposMovimientoRoutes = require('./modules/tipos-movimiento/tiposMovimiento.routes');
const catalogoRoutes = require('./modules/catalogo/catalogo.routes');
const comprobantesRoutes = require('./modules/comprobantes/comprobantes.routes');
const proveedoresRoutes = require('./modules/proveedores/proveedores.routes');
const tiposComprobanteRoutes = require('./modules/tipos-comprobante/tiposComprobante.routes');
const condicionesFiscalesRoutes = require('./modules/condiciones-fiscales/condicionesFiscales.routes');
const metodosPagoRoutes = require('./modules/metodos-pago/metodosPago.routes');
const ordenesPagoRoutes = require('./modules/ordenes-pago/ordenesPago.routes');
const cuentaCorrienteRoutes = require('./modules/cuenta-corriente/cuentaCorriente.routes');

const app = express();

app.use(cors({ origin: env.CORS_ORIGINS }));
app.use(express.json());

// ---------------------------------------------------------------------------
// Rutas. TODAS las del sistema se montan acá.
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) =>
  res.json({ ok: true, service: 'SIGH — Hotel Alejandro I', env: env.NODE_ENV })
);

app.use('/api/depositos', depositosRoutes);
app.use('/api/articulos', articulosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/tipos-movimiento', tiposMovimientoRoutes);
app.use('/api/catalogo', catalogoRoutes);

// Sprint 2 — comprobantes de proveedores y órdenes de pago
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/condiciones-fiscales', condicionesFiscalesRoutes);
app.use('/api/tipos-comprobante', tiposComprobanteRoutes);
app.use('/api/comprobantes', comprobantesRoutes);
app.use('/api/metodos-pago', metodosPagoRoutes);
app.use('/api/ordenes-pago', ordenesPagoRoutes);
app.use('/api/ordenes-compra', ordenesCompraRoutes);
app.use('/api/cuenta-corriente', cuentaCorrienteRoutes);
// ---------------------------------------------------------------------------
// Alias en inglés.
// ---------------------------------------------------------------------------
app.use('/api/deposits', depositosRoutes);
app.use('/api/movement-types', tiposMovimientoRoutes);
app.use('/api/catalog', catalogoRoutes);
app.use('/api/stock-movements', stockRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;