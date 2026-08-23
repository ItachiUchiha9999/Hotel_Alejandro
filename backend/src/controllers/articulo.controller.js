const ArticuloModel = require('../models/articulo.model');

const ArticuloController = {
  // POST /api/articulos
  async crear(req, res, next) {
    try {
      const { codigo, numero, nombre, nombreCompuesto, categoriaId, unidadMedida, stockMinimo, descripcion } = req.body;

      const faltantes = [];
      if (!codigo || !codigo.trim()) faltantes.push('codigo');
      if (!numero || !String(numero).trim()) faltantes.push('numero');
      if (!nombre || !nombre.trim()) faltantes.push('nombre');
      if (!nombreCompuesto || !nombreCompuesto.trim()) faltantes.push('nombreCompuesto');
      if (!categoriaId) faltantes.push('categoriaId');

      if (faltantes.length) {
        return res.status(400).json({ error: `Faltan campos obligatorios: ${faltantes.join(', ')}` });
      }

      const articulo = await ArticuloModel.crear({
        codigo: codigo.trim(),
        numero: String(numero).trim(),
        nombre: nombre.trim(),
        nombreCompuesto: nombreCompuesto.trim(),
        categoriaId,
        unidadMedida,
        stockMinimo,
        descripcion,
      });
      return res.status(201).json(articulo);
    } catch (err) {
      if (err.code === '23505') {
        // violación de UNIQUE(article_code) -> "el código no debe repetirse"
        return res.status(409).json({ error: 'Ya existe un artículo con ese código' });
      }
      if (err.code === '23503') {
        return res.status(400).json({ error: 'La categoría indicada no existe' });
      }
      return next(err);
    }
  },

  // GET /api/articulos?activos=true
  async listar(req, res, next) {
    try {
      const soloActivos = req.query.activos === 'true';
      const articulos = await ArticuloModel.listar({ soloActivos });
      return res.json(articulos);
    } catch (err) {
      return next(err);
    }
  },

  // GET /api/articulos/:id
  async obtener(req, res, next) {
    try {
      const articulo = await ArticuloModel.obtenerPorId(req.params.id);
      if (!articulo) return res.status(404).json({ error: 'Artículo no encontrado' });
      return res.json(articulo);
    } catch (err) {
      return next(err);
    }
  },

  // PUT /api/articulos/:id
  async actualizar(req, res, next) {
    try {
      const existente = await ArticuloModel.obtenerPorId(req.params.id);
      if (!existente) return res.status(404).json({ error: 'Artículo no encontrado' });

      const { numero, nombre, nombreCompuesto, descripcion, unidadMedida, stockMinimo, categoriaId } = req.body;
      const actualizado = await ArticuloModel.actualizar(req.params.id, {
        numero: numero ? String(numero).trim() : null,
        nombre: nombre ? nombre.trim() : null,
        nombreCompuesto: nombreCompuesto ? nombreCompuesto.trim() : null,
        descripcion: descripcion ?? null,
        unidadMedida: unidadMedida ?? null,
        stockMinimo: stockMinimo ?? null,
        categoriaId: categoriaId ?? null,
      });
      return res.json(actualizado);
    } catch (err) {
      if (err.code === '23503') {
        return res.status(400).json({ error: 'La categoría indicada no existe' });
      }
      return next(err);
    }
  },

  // PATCH /api/articulos/:id/estado  { "estado": true|false }
  async cambiarEstado(req, res, next) {
    try {
      const { estado } = req.body;
      if (typeof estado !== 'boolean') {
        return res.status(400).json({ error: 'El campo "estado" debe ser booleano (true = activo, false = inactivo)' });
      }

      const existente = await ArticuloModel.obtenerPorId(req.params.id);
      if (!existente) return res.status(404).json({ error: 'Artículo no encontrado' });

      const actualizado = await ArticuloModel.cambiarEstado(req.params.id, estado);
      return res.json(actualizado);
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = ArticuloController;