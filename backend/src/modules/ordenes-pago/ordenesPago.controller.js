    const service = require('./ordenesPago.service');

    const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

    // GET /api/ordenes-pago
    const listar = asyncHandler(async (req, res) => {
    const data = await service.listar({
        supplierId: req.query.supplier_id,
    });

    res.json({
        ok: true,
        data,
    });
    });

    // GET /api/ordenes-pago/metodos
    const listarMetodosPago = asyncHandler(async (req, res) => {
    const data = await service.listarMetodosPago();

    res.json({
        ok: true,
        data,
    });
    });

    // GET /api/ordenes-pago/cuenta-corriente/:supplierId
    const obtenerCuentaCorriente = asyncHandler(async (req, res) => {
    const data = await service.obtenerCuentaCorriente(
        req.params.supplierId
    );

    res.json({
        ok: true,
        data,
    });
    });

    // GET /api/ordenes-pago/:id
    const obtener = asyncHandler(async (req, res) => {
    const data = await service.obtener(req.params.id);

    res.json({
        ok: true,
        data,
    });
    });

    // POST /api/ordenes-pago
    const crear = asyncHandler(async (req, res) => {
    const data = await service.crear(req.body);

    res.status(201).json({
        ok: true,
        data,
    });
    });

    // POST /api/ordenes-pago/:id/detalles
    const agregarDetalle = asyncHandler(async (req, res) => {
    const data = await service.agregarDetalle(
        req.params.id,
        req.body
    );

    res.status(201).json({
        ok: true,
        data,
    });
    });

    // POST /api/ordenes-pago/:id/confirmar
    const confirmar = asyncHandler(async (req, res) => {
    const data = await service.confirmar(req.params.id);

    res.json({
        ok: true,
        data,
    });
    });

    // POST /api/ordenes-pago/:id/resetear
    const resetear = asyncHandler(async (req, res) => {
    const data = await service.resetear(
        req.params.id,
        req.body
    );

    res.json({
        ok: true,
        data,
    });
    });

    module.exports = {
    listar,
    obtener,
    listarMetodosPago,
    obtenerCuentaCorriente,
    crear,
    agregarDetalle,
    confirmar,
    resetear,
    };