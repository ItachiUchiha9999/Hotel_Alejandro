const prisma = require('../../db/prisma');
const env = require('../../config/env');

const {
  noEncontrado,
  conflicto,
  invalido,
} = require('../../utils/AppError');

const {
  toId,
  toPositive,
  toText,
} = require('../../utils/parse');

const ESTADOS_VALIDOS = [
  'BORRADOR',
  'EMITIDA',
  'APROBADA',
  'RECIBIDA',
  'CANCELADA',
];

const toDate = (valor) => {
  const texto = toText(valor);

  if (!texto) {
    return null;
  }

  const fecha = new Date(`${texto}T00:00:00`);

  return Number.isNaN(fecha.getTime())
    ? null
    : fecha;
};

const validarEstado = (valor) => {
  const estado = toText(valor)?.toUpperCase();

  if (
    !estado ||
    !ESTADOS_VALIDOS.includes(estado)
  ) {
    throw invalido(
      'El estado debe ser BORRADOR, EMITIDA, APROBADA, RECIBIDA o CANCELADA.'
    );
  }

  return estado;
};

const generarNumeroOrden = async (tx) => {
  const ultimaOrden =
    await tx.purchase_order.findFirst({
      orderBy: {
        purchase_order_id: 'desc',
      },
      select: {
        purchase_order_id: true,
      },
    });

  const siguienteNumero =
    (ultimaOrden?.purchase_order_id ?? 0) + 1;

  return `OC-${String(
    siguienteNumero
  ).padStart(6, '0')}`;
};

const validarEmpleado = async (
  cliente,
  payload = {}
) => {
  const employeeId =
    toId(payload.employees_id) ||
    env.DEFAULT_EMPLOYEE_ID;

  const empleado =
    await cliente.employees.findUnique({
      where: {
        employees_id: employeeId,
      },
    });

  if (!empleado) {
    throw invalido(
      'No se pudo identificar al empleado responsable.'
    );
  }

  return employeeId;
};

const validarProveedorActivo = async (
  cliente,
  supplierId
) => {
  if (!supplierId) {
    throw invalido(
      'Seleccioná un proveedor.'
    );
  }

  const proveedor =
    await cliente.suppliers.findUnique({
      where: {
        supplier_id: supplierId,
      },
    });

  if (!proveedor) {
    throw noEncontrado(
      'El proveedor seleccionado no existe.'
    );
  }

  if (!proveedor.supplier_state) {
    throw conflicto(
      `El proveedor "${proveedor.supplier_legal_name}" está inactivo.`
    );
  }

  return proveedor;
};

const prepararDetalles = async (
  cliente,
  payload = {},
  exigirDetalle = false
) => {
  const detalles =
    payload.detalles ??
    payload.details ??
    payload.items ??
    [];

  if (!Array.isArray(detalles)) {
    throw invalido(
      'El detalle de la orden no es válido.'
    );
  }

  if (
    exigirDetalle &&
    detalles.length === 0
  ) {
    throw invalido(
      'No se puede emitir una orden de compra sin artículos o servicios.'
    );
  }

  const detallesPreparados = [];

  for (
    let i = 0;
    i < detalles.length;
    i += 1
  ) {
    const detalle = detalles[i] || {};

    const articleId = toId(
      detalle.article_id ??
        detalle.articuloId
    );

    let descripcion = toText(
      detalle.item_description ??
        detalle.descripcion
    );

    const cantidad = toPositive(
      detalle.quantity ??
        detalle.cantidad
    );

    const precio = toPositive(
      detalle.unit_price ??
        detalle.precioUnitario
    );

    if (!cantidad) {
      throw invalido(
        `La cantidad del ítem ${
          i + 1
        } debe ser mayor a cero.`
      );
    }

    if (!precio) {
      throw invalido(
        `El precio unitario del ítem ${
          i + 1
        } debe ser mayor a cero.`
      );
    }

    if (articleId) {
      const articulo =
        await cliente.articles.findUnique({
          where: {
            article_id: articleId,
          },
        });

      if (!articulo) {
        throw noEncontrado(
          `El artículo del ítem ${
            i + 1
          } no existe.`
        );
      }

      if (!descripcion) {
        descripcion =
          articulo.article_name;
      }
    }

    if (
      !articleId &&
      !descripcion
    ) {
      throw invalido(
        `Ingresá una descripción para el ítem ${
          i + 1
        }.`
      );
    }

    detallesPreparados.push({
      article_id: articleId || null,
      item_description: descripcion,
      quantity: cantidad,
      unit_price: precio,
    });
  }

  return detallesPreparados;
};

const obtener = async (id) => {
  const orderId = toId(id);

  if (!orderId) {
    throw invalido(
      'El identificador de la orden de compra no es válido.'
    );
  }

  const orden =
    await prisma.purchase_order.findUnique({
      where: {
        purchase_order_id: orderId,
      },
      include: {
        suppliers: {
          select: {
            supplier_id: true,
            supplier_legal_name: true,
            supplier_trade_name: true,
            supplier_cuit: true,
            supplier_address: true,
            supplier_state: true,
          },
        },
        employees: {
          select: {
            employees_id: true,
            employees_name: true,
            employees_lastname: true,
          },
        },
        purchase_order_detail: {
          include: {
            articles: {
              select: {
                article_id: true,
                article_code: true,
                article_name: true,
              },
            },
          },
        },
      },
    });

  if (!orden) {
    throw noEncontrado(
      'La orden de compra no existe.'
    );
  }

  return orden;
};

const listar = async (
  filtros = {}
) => {
  const supplierId = toId(
    filtros.supplierId
  );

  const estadoTexto = toText(
    filtros.estado
  );

  const estado = estadoTexto
    ? validarEstado(estadoTexto)
    : null;

  const desde = toDate(
    filtros.desde
  );

  const hasta = toDate(
    filtros.hasta
  );

  const page = Math.max(
    1,
    Number(filtros.page) || 1
  );

  const limit = Math.min(
    100,
    Math.max(
      1,
      Number(filtros.limit) || 10
    )
  );

  if (
    desde &&
    hasta &&
    hasta < desde
  ) {
    throw invalido(
      'La fecha "hasta" no puede ser anterior a la fecha "desde".'
    );
  }

  const where = {};

  if (supplierId) {
    where.supplier_id =
      supplierId;
  }

  if (estado) {
    where.purchase_order_status =
      estado;
  }

  if (desde || hasta) {
    where.issue_date = {};

    if (desde) {
      where.issue_date.gte =
        desde;
    }

    if (hasta) {
      where.issue_date.lte =
        hasta;
    }
  }

  const skip =
    (page - 1) * limit;

  const [data, total] =
    await prisma.$transaction([
      prisma.purchase_order.findMany({
        where,
        skip,
        take: limit,
        include: {
          suppliers: {
            select: {
              supplier_id: true,
              supplier_legal_name: true,
              supplier_trade_name: true,
              supplier_cuit: true,
              supplier_address: true,
              supplier_state: true,
            },
          },
          employees: {
            select: {
              employees_id: true,
              employees_name: true,
              employees_lastname: true,
            },
          },
          purchase_order_detail: true,
          _count: {
            select: {
              purchase_order_detail: true,
            },
          },
        },
        orderBy: [
          {
            issue_date: 'desc',
          },
          {
            purchase_order_id:
              'desc',
          },
        ],
      }),

      prisma.purchase_order.count({
        where,
      }),
    ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages:
        Math.ceil(total / limit),
    },
  };
};

const crear = async (
  payload = {}
) => {
  const supplierId = toId(
    payload.supplier_id ??
      payload.proveedorId
  );

  await validarProveedorActivo(
    prisma,
    supplierId
  );

  const fechaEmision = toDate(
    payload.issue_date ??
      payload.fechaEmision
  );

  if (!fechaEmision) {
    throw invalido(
      'Ingresá una fecha de emisión válida.'
    );
  }

  const fechaEsperada = toDate(
    payload.expected_date ??
      payload.fechaEntrega
  );

  if (
    fechaEsperada &&
    fechaEsperada < fechaEmision
  ) {
    throw invalido(
      'La fecha estimada de entrega no puede ser anterior a la fecha de emisión.'
    );
  }

  const employeeId =
    await validarEmpleado(
      prisma,
      payload
    );

  const emitir =
    payload.emitir === true ||
    payload.purchase_order_status ===
      'EMITIDA';

  const detallesPreparados =
    await prepararDetalles(
      prisma,
      payload,
      emitir
    );

  return prisma.$transaction(
    async (tx) => {
      const numero =
        await generarNumeroOrden(tx);

      const orden =
        await tx.purchase_order.create({
          data: {
            purchase_order_number:
              numero,
            supplier_id:
              supplierId,
            issue_date:
              fechaEmision,
            expected_date:
              fechaEsperada,
            purchase_conditions:
              toText(
                payload.purchase_conditions ??
                  payload.condicionesCompra
              ),
            purchase_order_status:
              'BORRADOR',
            observations:
              toText(
                payload.observations ??
                  payload.observaciones
              ),
            employees_id:
              employeeId,
          },
        });

      for (
        const detalle of
        detallesPreparados
      ) {
        await tx.purchase_order_detail.create({
          data: {
            purchase_order_id:
              orden.purchase_order_id,
            article_id:
              detalle.article_id,
            item_description:
              detalle.item_description,
            quantity:
              detalle.quantity,
            unit_price:
              detalle.unit_price,
          },
        });
      }

      if (emitir) {
        await tx.purchase_order.update({
          where: {
            purchase_order_id:
              orden.purchase_order_id,
          },
          data: {
            purchase_order_status:
              'EMITIDA',
            employees_id:
              employeeId,
          },
        });
      }

      return tx.purchase_order.findUnique({
        where: {
          purchase_order_id:
            orden.purchase_order_id,
        },
        include: {
          suppliers: true,
          employees: true,
          purchase_order_detail: {
            include: {
              articles: true,
            },
          },
        },
      });
    }
  );
};

const editar = async (
  id,
  payload = {}
) => {
  const orderId = toId(id);

  if (!orderId) {
    throw invalido(
      'El identificador de la orden no es válido.'
    );
  }

  const ordenActual =
    await prisma.purchase_order.findUnique({
      where: {
        purchase_order_id:
          orderId,
      },
      include: {
        purchase_order_detail:
          true,
      },
    });

  if (!ordenActual) {
    throw noEncontrado(
      'La orden de compra no existe.'
    );
  }

  if (
    ordenActual.purchase_order_status !==
    'BORRADOR'
  ) {
    throw conflicto(
      'Solo se pueden editar órdenes que estén en BORRADOR.'
    );
  }

  const supplierId = toId(
    payload.supplier_id ??
      payload.proveedorId
  );

  await validarProveedorActivo(
    prisma,
    supplierId
  );

  const fechaEmision = toDate(
    payload.issue_date ??
      payload.fechaEmision
  );

  if (!fechaEmision) {
    throw invalido(
      'Ingresá una fecha de emisión válida.'
    );
  }

  const fechaEsperada = toDate(
    payload.expected_date ??
      payload.fechaEntrega
  );

  if (
    fechaEsperada &&
    fechaEsperada < fechaEmision
  ) {
    throw invalido(
      'La fecha estimada de entrega no puede ser anterior a la fecha de emisión.'
    );
  }

  const employeeId =
    await validarEmpleado(
      prisma,
      payload
    );

  const emitir =
    payload.emitir === true ||
    payload.purchase_order_status ===
      'EMITIDA';

  const detallesPreparados =
    await prepararDetalles(
      prisma,
      payload,
      emitir
    );

  return prisma.$transaction(
    async (tx) => {
      const orden =
        await tx.purchase_order.findUnique({
          where: {
            purchase_order_id:
              orderId,
          },
        });

      if (!orden) {
        throw noEncontrado(
          'La orden de compra no existe.'
        );
      }

      if (
        orden.purchase_order_status !==
        'BORRADOR'
      ) {
        throw conflicto(
          'Solo se pueden editar órdenes que estén en BORRADOR.'
        );
      }

      await tx.purchase_order.update({
        where: {
          purchase_order_id:
            orderId,
        },
        data: {
          supplier_id:
            supplierId,
          issue_date:
            fechaEmision,
          expected_date:
            fechaEsperada,
          purchase_conditions:
            toText(
              payload.purchase_conditions ??
                payload.condicionesCompra
            ),
          observations:
            toText(
              payload.observations ??
                payload.observaciones
            ),
          employees_id:
            employeeId,
        },
      });

      await tx.purchase_order_detail.deleteMany({
        where: {
          purchase_order_id:
            orderId,
        },
      });

      for (
        const detalle of
        detallesPreparados
      ) {
        await tx.purchase_order_detail.create({
          data: {
            purchase_order_id:
              orderId,
            article_id:
              detalle.article_id,
            item_description:
              detalle.item_description,
            quantity:
              detalle.quantity,
            unit_price:
              detalle.unit_price,
          },
        });
      }

      if (emitir) {
        await tx.purchase_order.update({
          where: {
            purchase_order_id:
              orderId,
          },
          data: {
            purchase_order_status:
              'EMITIDA',
            employees_id:
              employeeId,
          },
        });
      }

      return tx.purchase_order.findUnique({
        where: {
          purchase_order_id:
            orderId,
        },
        include: {
          suppliers: true,
          employees: true,
          purchase_order_detail: {
            include: {
              articles: true,
            },
          },
        },
      });
    }
  );
};

const cambiarEstado = async (
  id,
  payload = {}
) => {
  const orderId = toId(id);

  if (!orderId) {
    throw invalido(
      'El identificador de la orden no es válido.'
    );
  }

  const nuevoEstado =
    validarEstado(
      payload.estado
    );

  const employeeId =
    await validarEmpleado(
      prisma,
      payload
    );

  const orden =
    await prisma.purchase_order.findUnique({
      where: {
        purchase_order_id:
          orderId,
      },
      include: {
        purchase_order_detail:
          true,
      },
    });

  if (!orden) {
    throw noEncontrado(
      'La orden de compra no existe.'
    );
  }

  if (
    orden.purchase_order_status ===
    nuevoEstado
  ) {
    throw conflicto(
      `La orden ya se encuentra en estado ${nuevoEstado}.`
    );
  }

  if (
    nuevoEstado === 'EMITIDA' &&
    orden.purchase_order_detail
      .length === 0
  ) {
    throw invalido(
      'No se puede emitir una orden sin artículos o servicios.'
    );
  }

  if (
    orden.purchase_order_status ===
    'CANCELADA'
  ) {
    throw conflicto(
      'Una orden cancelada no puede cambiar de estado.'
    );
  }

  if (
    orden.purchase_order_status ===
    'RECIBIDA'
  ) {
    throw conflicto(
      'Una orden recibida ya se encuentra finalizada.'
    );
  }

  await prisma.purchase_order.update({
    where: {
      purchase_order_id:
        orderId,
    },
    data: {
      purchase_order_status:
        nuevoEstado,
      employees_id:
        employeeId,
    },
  });

  return obtener(orderId);
};

module.exports = {
  listar,
  obtener,
  crear,
  editar,
  cambiarEstado,
};