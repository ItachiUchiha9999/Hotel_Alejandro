const express = require('express');
const cors = require('cors');
const articuloRoutes = require('./routes/articulo.routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

// Rutas de STK-02: Catálogo de Artículos
app.use('/api/articulos', articuloRoutes);

// Manejo centralizado de errores
app.use(errorHandler);

module.exports = app;