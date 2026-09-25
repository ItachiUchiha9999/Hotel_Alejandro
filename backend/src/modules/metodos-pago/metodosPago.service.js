const prisma = require('../../db/prisma');

const listar = async ({ soloActivos = false } = {}) =>
  prisma.payment_method.findMany({
    where: soloActivos ? { active: true } : undefined,
    orderBy: { payment_method_id: 'asc' },
  });

module.exports = { listar };