const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuramos la conexión obligatoria para Prisma
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

app.use(cors());
app.use(express.json());

// Ruta de prueba
app.get('/test-db', async (req, res) => {
  try {
    await prisma.$connect();
    res.json({ mensaje: '¡Conexión a PostgreSQL exitosa! 🐘' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Fallo al conectar a la base de datos' });
  }
});

// Ruta GET: Obtener la lista de depósitos
app.get(['/api/depositos', '/depositos'], async (req, res) => {
  try {
    const depositos = await prisma.deposito.findMany({
      orderBy: { id: 'desc' }
    });
    res.json(depositos);
  } catch (error) {
    console.error("Detalle del error Prisma:", error);
    res.status(500).json({ error: 'Hubo un error al cargar los depósitos.' });
  }
});

// 🔥 RUTA POST: Crear un depósito nuevo (STK-01)
app.post(['/api/depositos', '/depositos'], async (req, res) => {
  const { nombre, estado } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre del depósito es obligatorio.' });
  }

  try {
    // Validar si ya existe el nombre
    const depositoExistente = await prisma.deposito.findUnique({
      where: { nombre }
    });

    if (depositoExistente) {
      return res.status(400).json({ error: 'Ya existe un depósito con ese nombre.' });
    }

    const nuevoDeposito = await prisma.deposito.create({
      data: {
        nombre,
        estado: estado || 'Activo'
      }
    });

    res.status(201).json(nuevoDeposito);
  } catch (error) {
    console.error("Error al crear depósito:", error);
    res.status(500).json({ error: 'Hubo un error interno al guardar el depósito.' });
  }
});

// Escucha del servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});

// 1. RUTA PARA OBTENER UN DEPÓSITO POR SU ID (Para cuando haces clic en Editar)
app.get('/api/depositos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deposito = await prisma.deposito.findUnique({
      where: { id: Number(id) }
    });
    if (!deposito) {
      return res.status(404).json({ error: "Depósito no encontrado" });
    }
    res.json(deposito);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener el depósito" });
  }
});

// 2. RUTA PARA ACTUALIZAR UN DEPÓSITO (Para cuando guardas los cambios)
app.post('/api/depositos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, estado } = req.body;
    
    const depositoActualizado = await prisma.deposito.update({
      where: { id: Number(id) },
      data: { nombre, estado }
    });
    
    res.json(depositoActualizado);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar el depósito" });
  }
});