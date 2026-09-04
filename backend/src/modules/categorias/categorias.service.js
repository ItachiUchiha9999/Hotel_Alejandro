const prisma = require('../../db/prisma');
const { noEncontrado, invalido, conflicto } = require('../../utils/AppError');
const { toId, toText, toBool } = require('../../utils/parse');

const listar = async ({ soloActivos = false } = {}) =>
    prisma.categories.findMany({
        where: soloActivos ? { category_state: true } : undefined,
        orderBy: { category_name: 'asc' },
    });

const obtener = async (id) => {
    const categoryId = toId(id);
    if (!categoryId) throw invalido('El identificador de la categoría no es válido.');

    const categoria = await prisma.categories.findUnique({ where: { category_id: categoryId } });
    if (!categoria) throw noEncontrado('La categoría no existe.');
    return categoria;
};

const crear = async (datos) => {
    const nombre = toText(datos.category_name ?? datos.nombre);
    if (!nombre) throw invalido('El nombre de la categoría es obligatorio.');

    try {
        return await prisma.categories.create({
            data: {
                category_name: nombre,
                category_description: toText(datos.category_description ?? datos.descripcion),
                category_state: toBool(datos.category_state ?? datos.estado, true),
            },
        });
    } catch (err) {
        if (err.code === 'P2002') throw conflicto('Ya existe una categoría con ese nombre.');
        throw err;
    }
};

const actualizar = async (id, datos) => {
    const categoria = await obtener(id);

    const nombre = toText(datos.category_name ?? datos.nombre);
    const descripcion = datos.category_description ?? datos.descripcion;
    const estado = toBool(datos.category_state ?? datos.estado, null);

    try {
        return await prisma.categories.update({
            where: { category_id: categoria.category_id },
            data: {
                ...(nombre ? { category_name: nombre } : {}),
                ...(descripcion !== undefined ? { category_description: toText(descripcion) } : {}),
                ...(estado !== null ? { category_state: estado } : {}),
            },
        });
    } catch (err) {
        if (err.code === 'P2002') throw conflicto('Ya existe una categoría con ese nombre.');
        throw err;
    }
};

/** Baja lógica: las categorías nunca se borran, se desactivan. */
const cambiarEstado = async (id, estado) => {
    const categoria = await obtener(id);
    const nuevoEstado = toBool(estado, !categoria.category_state);

    return prisma.categories.update({
        where: { category_id: categoria.category_id },
        data: { category_state: nuevoEstado },
    });
};

module.exports = { listar, obtener, crear, actualizar, cambiarEstado };