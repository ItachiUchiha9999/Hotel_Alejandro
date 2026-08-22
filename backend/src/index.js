require('dotenv/config');
const express = require('express');
const cors = require('cors');
const transferRoutes = require('./routes/transfer.routes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/transferencias', transferRoutes);
app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
