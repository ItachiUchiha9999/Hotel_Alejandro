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

module.exports = { getStockByDeposit };