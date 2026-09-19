const prisma = require('../../db/prisma');
const { noEncontrado, invalido, conflicto } = require('../../utils/AppError');
const { toId, toText, toBool, toNonNegative } = require('../../utils/parse');

/**
 * Catálogo de artículos (STK-02).
 * Antes este módulo usaba `pg` directamente contra un `../config/db` que no
 * existía en el repo, así que el endpoint entero rompía al importarse. Ahora
 * usa el mismo cliente Prisma que el resto del backend.
 */

/** Aplana la categoría para que el listado traiga category_name en la raíz. */
const aDTO = (a) => ({
  article_id: a.article_id,
  category_id: a.category_id,
  category_name: a.categories?.category_name ?? null,
  article_code: a.article_code,
  article_number: a.article_number,
  article_name: a.article_name,
  article_compound_name: a.article_compound_name,
  article_description: a.article_description,
  article_unit_of_measure: a.article_unit_of_measure,
  article_stock_min_general: a.article_stock_min_general,
  article_state: a.article_state,
  creation_date: a.creation_date,
});

const listar = async ({ soloActivos = false } = {}) => {
  const articulos = await prisma.articles.findMany({
    where: soloActivos ? { article_state: true } : undefined,
    include: { categories: { select: { category_name: true } } },
    orderBy: { article_name: 'asc' },
  });
  return articulos.map(aDTO);
};

const obtener = async (id) => {
  const articleId = toId(id);
  if (!articleId) throw invalido('El identificador del artículo no es válido.');

  const articulo = await prisma.articles.findUnique({
    where: { article_id: articleId },
    include: { categories: { select: { category_name: true } } },
  });
  if (!articulo) throw noEncontrado('El artículo no existe.');
  return aDTO(articulo);
};

/** Normaliza el cuerpo, que puede venir en español (formulario) o en inglés. */
const leerDatos = (datos = {}) => ({
  codigo: toText(datos.codigo ?? datos.article_code),
  numero: toText(datos.numero ?? datos.article_number),
  nombre: toText(datos.nombre ?? datos.article_name),
  nombreCompuesto: toText(datos.nombreCompuesto ?? datos.article_compound_name),
  descripcion: toText(datos.descripcion ?? datos.article_description),
  categoriaId: toId(datos.categoriaId ?? datos.category_id),
  unidadMedida: toText(datos.unidadMedida ?? datos.article_unit_of_measure) || 'UNIDAD',
  stockMinimo: toNonNegative(datos.stockMinimo ?? datos.article_stock_min_general) ?? 0,
});

/** Saca acentos para poder comparar/derivar prefijos sin líos de encoding. */
const quitarAcentos = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Prefijo de 3 letras a partir de la primera palabra del nombre de la
 * categoría (ej: "Frigobar y Snacks" -> "FRI"). Las categorías cargadas por
 * el seed original usan a veces la palabra más representativa en vez de la
 * primera (Ej: "Artículos de Limpieza" -> LIM), así que esto solo aplica
 * a categorías nuevas, creadas desde la pantalla de Categorías.
 */
const prefijoDeCategoria = (nombre) => {
  const primeraPalabra = quitarAcentos(nombre).trim().split(/\s+/)[0] ?? '';
  const soloLetras = primeraPalabra.replace(/[^a-zA-Z]/g, '');
  return (soloLetras.slice(0, 3) || 'ART').toUpperCase().padEnd(3, 'X');
};

/**
 * Código automático para el próximo artículo de una categoría: busca el
 * mayor correlativo ya usado con ese prefijo y devuelve el siguiente
 * (ej: ya existen BLA-001 y BLA-002 -> devuelve BLA-003). El correlativo
 * arranca de nuevo en cada categoría.
 */
const siguienteCodigo = async (categoriaId) => {
  const catId = toId(categoriaId);
  if (!catId) throw invalido('El identificador de la categoría no es válido.');

  const categoria = await prisma.categories.findUnique({ where: { category_id: catId } });
  if (!categoria) throw noEncontrado('La categoría seleccionada no existe.');

  const prefijo = prefijoDeCategoria(categoria.category_name);

  const existentes = await prisma.articles.findMany({
    where: { article_code: { startsWith: `${prefijo}-` } },
    select: { article_code: true },
  });

  let max = 0;
  for (const { article_code } of existentes) {
    const sufijo = article_code.slice(prefijo.length + 1);
    const num = parseInt(sufijo, 10);
    if (!Number.isNaN(num) && num > max) max = num;
  }

  const siguiente = max + 1;
  const codigo = `${prefijo}-${String(siguiente).padStart(3, '0')}`;
  return { codigo, prefijo, categoria_id: catId };
};

const crear = async (body) => {
  const d = leerDatos(body);

  if (!d.nombre) throw invalido('El nombre del artículo es obligatorio.');
  if (!d.categoriaId) throw invalido('Elegí una categoría para el artículo.');

  const categoria = await prisma.categories.findUnique({ where: { category_id: d.categoriaId } });
  if (!categoria) throw noEncontrado('La categoría seleccionada no existe.');

  // El código SIEMPRE se calcula del lado del servidor. Si el cliente manda
  // algo en "codigo" (por ejemplo, una vista previa vieja), se ignora: la
  // fuente de verdad del correlativo es la base, justo antes de guardar.
  const { codigo } = await siguienteCodigo(d.categoriaId);

  try {
    const creado = await prisma.articles.create({
      data: {
        category_id: d.categoriaId,
        article_code: codigo,
        article_number: d.numero,
        article_name: d.nombre,
        article_compound_name: d.nombreCompuesto,
        article_description: d.descripcion,
        article_unit_of_measure: d.unidadMedida,
        article_stock_min_general: d.stockMinimo,
      },
      include: { categories: { select: { category_name: true } } },
    });
    return aDTO(creado);
  } catch (err) {
    if (err.code === 'P2002') {
      throw conflicto('Ya se generó ese código justo ahora para otro artículo, probá guardar de nuevo.');
    }
    throw err;
  }
};

const actualizar = async (id, body) => {
  const actual = await obtener(id);
  const d = leerDatos(body);

  if (d.categoriaId) {
    const categoria = await prisma.categories.findUnique({ where: { category_id: d.categoriaId } });
    if (!categoria) throw noEncontrado('La categoría seleccionada no existe.');
  }

  const actualizado = await prisma.articles.update({
    where: { article_id: actual.article_id },
    data: {
      ...(d.categoriaId ? { category_id: d.categoriaId } : {}),
      ...(d.codigo ? { article_code: d.codigo } : {}),
      ...(body.numero !== undefined || body.article_number !== undefined
        ? { article_number: d.numero }
        : {}),
      ...(d.nombre ? { article_name: d.nombre } : {}),
      ...(body.nombreCompuesto !== undefined || body.article_compound_name !== undefined
        ? { article_compound_name: d.nombreCompuesto }
        : {}),
      ...(body.descripcion !== undefined || body.article_description !== undefined
        ? { article_description: d.descripcion }
        : {}),
      article_unit_of_measure: d.unidadMedida,
      article_stock_min_general: d.stockMinimo,
    },
    include: { categories: { select: { category_name: true } } },
  });

  return aDTO(actualizado);
};

/** Baja lógica del artículo. */
const cambiarEstado = async (id, estado) => {
  const actual = await obtener(id);
  const nuevoEstado = toBool(estado, !actual.article_state);

  const actualizado = await prisma.articles.update({
    where: { article_id: actual.article_id },
    data: { article_state: nuevoEstado },
    include: { categories: { select: { category_name: true } } },
  });

  return aDTO(actualizado);
};

module.exports = { listar, obtener, crear, actualizar, cambiarEstado, siguienteCodigo };