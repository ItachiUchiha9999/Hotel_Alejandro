const stockService = require('../services/stock.service');

const getStockByDeposit = async (req, res) => {
  try {
    const { depositId } = req.params;
    const stock = await stockService.getStockByDeposit(depositId);
    res.status(200).json({ ok: true, data: stock });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

const createStockMovement = async (req, res) => {
  try {
    const movementData = req.body;
    
    // Llamar al servicio que interactúa con Prisma/Base de datos
    const newMovement = await stockService.createMovement(movementData);
    
    res.status(201).json({ ok: true, data: newMovement });
  } catch (error) {
    console.error('Error en createStockMovement:', error);
    res.status(500).json({ ok: false, message: error.message || 'Error del servidor' });
  }
};

module.exports = { 
  getStockByDeposit,
  createStockMovement 
};