const prisma = require('../utils/prisma');

const getStockByDeposit = async (depositId) => {
  return await prisma.articles_deposit_stock.findMany({
    where: {
      deposit_id: Number(depositId),
    },
    include: {
      articles: {
        include: {
          categories: true,
        },
      },
      deposit: true,
    },
  });
};

module.exports = { getStockByDeposit };