const prisma = require('../../db/prisma');

const listar = async ({ soloActivas = false } = {}) =>
  prisma.tax_condition.findMany({
    where: soloActivas ? { active: true } : undefined,
    orderBy: { tax_condition_name: 'asc' },
  });

module.exports = { listar };