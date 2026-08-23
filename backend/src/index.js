require('dotenv').config();
const express = require('express');
const cors = require('cors');

const stockRoutes = require('./routes/stock.routes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/stock', stockRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'API Hotel Alejandro funcionando correctamente' });
});
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});