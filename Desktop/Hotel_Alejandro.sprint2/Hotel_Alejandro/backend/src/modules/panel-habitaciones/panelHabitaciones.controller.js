    const asyncHandler = require('../../utils/asyncHandler');

    const service = require('./panelHabitaciones.service');

    const listar = asyncHandler(async (req, res) => {
    const data = await service.listar();

    res.json({
        ok: true,
        data,
    });
    });

    module.exports = {
    listar,
    };