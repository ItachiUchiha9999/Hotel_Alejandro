const { Router } = require('express');
const c = require('./tiposHabitacion.controller');

const router = Router();

router.get('/', c.listar);
router.post('/', c.crear);
router.get('/:id', c.obtener);
router.put('/:id', c.actualizar);
router.patch('/:id/estado', c.cambiarEstado);

module.exports = router;

// PATCH: Activar o desactivar tipo de habitación
router.patch('/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const actualizado = await prisma.room_type.update({
      where: { room_type_id: Number(id) },
      data: { active: estado }
    });

    res.json({ data: actualizado });
  } catch (error) {
    console.error("Error en PATCH /estado:", error);
    res.status(500).json({ error: "No se pudo cambiar el estado" });
  }
});

// PUT: Editar tipo de habitación existente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const datos = req.body;

    // 1. Actualizamos los datos principales de la habitación
    const actualizado = await prisma.room_type.update({
      where: { room_type_id: Number(id) },
      data: {
        room_type_name: datos.room_type_name,
        description: datos.description,
        max_capacity: datos.max_capacity,
        max_adults: datos.max_adults,
        bed_setup: datos.bed_setup,
        square_meters: datos.square_meters,
        has_balcony: datos.has_balcony,
        has_minibar: datos.has_minibar,
        has_air_conditioning: datos.has_air_conditioning,
      }
    });

    // 2. Si se editó el precio base, creamos un nuevo registro en el historial de tarifas
    if (datos.base_price) {
      await prisma.room_type_rate.create({
        data: {
          room_type_id: Number(id),
          base_price: datos.base_price,
          employees_id: 1 // Asegúrate de tener un empleado con ID 1 en tu DB
        }
      });
    }

    res.json({ data: actualizado });
  } catch (error) {
    console.error("Error en PUT /:id :", error);
    res.status(500).json({ error: "No se pudo editar el tipo de habitación" });
  }
});