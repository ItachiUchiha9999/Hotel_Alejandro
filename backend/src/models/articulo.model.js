const pool = require('../config/db');

const ArticuloModel = {
  async crear({ codigo, numero, nombre, nombreCompuesto, categoriaId, unidadMedida, stockMinimo, descripcion }) {
    const query = `
      INSERT INTO articles (
        category_id, article_code, article_number, article_name,
        article_compound_name, article_description, article_unit_of_measure, article_stock_min_general
      )
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'UNIDAD'), COALESCE($8, 0))
      RETURNING article_id, category_id, article_code, article_number, article_name,
                article_compound_name, article_description, article_unit_of_measure,
                article_stock_min_general, article_state, creation_date;
    `;
    const { rows } = await pool.query(query, [
      categoriaId, codigo, numero, nombre, nombreCompuesto, descripcion, unidadMedida, stockMinimo,
    ]);
    return rows[0];
  },

  // en articulo.model.js, reemplazar el SELECT de listar() y obtenerPorId()
  async listar({ soloActivos = false } = {}) {
    let query = `
      SELECT a.*, c.category_name
      FROM articles a
      LEFT JOIN categories c ON c.category_id = a.category_id
    `;
    if (soloActivos) query += ` WHERE a.article_state = TRUE`;
    query += ` ORDER BY a.article_name ASC;`;
    const { rows } = await pool.query(query);
    return rows;
  },

  async obtenerPorId(id) {
    const { rows } = await pool.query(`SELECT * FROM articles WHERE article_id = $1;`, [id]);
    return rows[0];
  },

  async obtenerPorCodigo(codigo) {
    const { rows } = await pool.query(`SELECT * FROM articles WHERE article_code = $1;`, [codigo]);
    return rows[0];
  },

  async actualizar(id, { numero, nombre, nombreCompuesto, descripcion, unidadMedida, stockMinimo, categoriaId }) {
    const query = `
      UPDATE articles
      SET article_number = COALESCE($2, article_number),
          article_name = COALESCE($3, article_name),
          article_compound_name = COALESCE($4, article_compound_name),
          article_description = COALESCE($5, article_description),
          article_unit_of_measure = COALESCE($6, article_unit_of_measure),
          article_stock_min_general = COALESCE($7, article_stock_min_general),
          category_id = COALESCE($8, category_id)
      WHERE article_id = $1
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [
      id, numero, nombre, nombreCompuesto, descripcion, unidadMedida, stockMinimo, categoriaId,
    ]);
    return rows[0];
  },

  async cambiarEstado(id, estado) {
    const { rows } = await pool.query(
      `UPDATE articles SET article_state = $2 WHERE article_id = $1 RETURNING *;`,
      [id, estado]
    );
    return rows[0];
  },
};

module.exports = ArticuloModel;