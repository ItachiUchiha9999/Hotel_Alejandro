const { prisma, Prisma } = require('../lib/prisma');

async function registrarTransferencia({
  article_id,
  deposit_origin_id,
  deposit_destination_id,
  amount,
  employees_id,
  observations = null,
}) {
  const cantidad = new Prisma.Decimal(amount);

  if (cantidad.lte(0)) {
    throw { status: 400, message: 'La cantidad debe ser mayor a cero.' };
  }

  if (deposit_origin_id === deposit_destination_id) {
    throw { status: 400, message: 'El deposito de origen y el de destino no pueden ser el mismo.' };
  }

  return await prisma.$transaction(async (tx) => {
    const [articulo, origen, destino, empleado] = await Promise.all([
      tx.articles.findUnique({ where: { article_id } }),
      tx.deposit.findUnique({ where: { deposit_id: deposit_origin_id } }),
      tx.deposit.findUnique({ where: { deposit_id: deposit_destination_id } }),
      tx.employees.findUnique({ where: { employees_id } }),
    ]);

    if (!articulo) throw { status: 404, message: `No existe el articulo ${article_id}.` };
    if (!origen) throw { status: 404, message: `No existe el deposito de origen ${deposit_origin_id}.` };
    if (!destino) throw { status: 404, message: `No existe el deposito de destino ${deposit_destination_id}.` };
    if (!empleado) throw { status: 404, message: `No existe el empleado ${employees_id}.` };

    if (!origen.deposit_state) {
      throw { status: 400, message: `El deposito "${origen.deposit_name}" esta inactivo.` };
    }
    if (!destino.deposit_state) {
      throw { status: 400, message: `El deposito "${destino.deposit_name}" esta inactivo.` };
    }

    const stockOrigen = await tx.articles_deposit_stock.findUnique({
      where: { article_id_deposit_id: { article_id, deposit_id: deposit_origin_id } },
    });

    if (!stockOrigen) {
      throw {
        status: 409,
        message: `El articulo "${articulo.article_name}" no tiene stock registrado en "${origen.deposit_name}".`,
      };
    }

    if (stockOrigen.stock_amount.lt(cantidad)) {
      throw {
        status: 409,
        message: `Stock insuficiente en "${origen.deposit_name}". Disponible: ${stockOrigen.stock_amount}, solicitado: ${cantidad}.`,
      };
    }

    await tx.articles_deposit_stock.update({
      where: { article_id_deposit_id: { article_id, deposit_id: deposit_origin_id } },
      data: { stock_amount: { decrement: cantidad }, update_date: new Date() },
    });

    await tx.articles_deposit_stock.upsert({
      where: { article_id_deposit_id: { article_id, deposit_id: deposit_destination_id } },
      update: { stock_amount: { increment: cantidad }, update_date: new Date() },
      create: { article_id, deposit_id: deposit_destination_id, stock_amount: cantidad },
    });

    return await tx.stock_movement.create({
      data: {
        stock_movement_operation_type: 'TRANSFERENCIA',
        deposit_origin_id,
        deposit_destination_id,
        employees_id,
        observations,
        movement_stock_detail: { create: [{ article_id, amount: cantidad }] },
      },
      include: {
        movement_stock_detail: { include: { articles: true } },
        deposit_stock_movement_deposit_origin_idTodeposit: true,
        deposit_stock_movement_deposit_destination_idTodeposit: true,
      },
    });
  });
}

async function listarTransferencias() {
  return await prisma.stock_movement.findMany({
    where: { stock_movement_operation_type: 'TRANSFERENCIA' },
    orderBy: { transaction_date: 'desc' },
    include: {
      movement_stock_detail: { include: { articles: true } },
      deposit_stock_movement_deposit_origin_idTodeposit: true,
      deposit_stock_movement_deposit_destination_idTodeposit: true,
      employees: true,
    },
  });
}

module.exports = { registrarTransferencia, listarTransferencias };
