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

  /* ============================================================
    PROV-10 - ÓRDENES DE COMPRA
  ============================================================ */

  const ESTADOS_VALIDOS = [
    'BORRADOR',
    'EMITIDA',
    'APROBADA',
    'RECIBIDA',
    'CANCELADA',
  ];

  /* ============================================================
    HELPERS
  ============================================================ */

  const toDate = (valor) => {
    const texto = toText(valor);

    if (!texto) return null;

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

  /**
   * Genera:
   *
   * OC-000001
   * OC-000002
   * OC-000003
   */
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

  /* ============================================================
    LISTAR
  ============================================================ */

  const listar = async (filtros = {}) => {
    const supplierId =
      toId(filtros.supplierId);

    const estadoTexto =
      toText(filtros.estado);

    let estado = null;

    if (estadoTexto) {
      estado =
        validarEstado(estadoTexto);
    }

    const desde =
      toDate(filtros.desde);

    const hasta =
      toDate(filtros.hasta);

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

    return prisma.purchase_order.findMany({
      where,

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
          purchase_order_id: 'desc',
        },
      ],
    });
  };

  /* ============================================================
    OBTENER
  ============================================================ */

  const obtener = async (id) => {
    const orderId =
      toId(id);

    if (!orderId) {
      throw invalido(
        'El identificador de la orden de compra no es válido.'
      );
    }

    const orden =
      await prisma.purchase_order.findUnique({
        where: {
          purchase_order_id:
            orderId,
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

          status_history: {
            include: {
              employees: {
                select: {
                  employees_name: true,
                  employees_lastname: true,
                },
              },
            },

            orderBy: {
              changed_at: 'asc',
            },
          },

          supplier_voucher: true,
        },
      });

    if (!orden) {
      throw noEncontrado(
        'La orden de compra no existe.'
      );
    }

    return orden;
  };

  /* ============================================================
    CREAR
  ============================================================ */

  const crear = async (payload = {}) => {
    /* ----------------------------------------------------------
      PROVEEDOR
    ---------------------------------------------------------- */

    const supplierId =
      toId(
        payload.supplier_id ??
          payload.proveedorId
      );

    if (!supplierId) {
      throw invalido(
        'Seleccioná un proveedor.'
      );
    }

    const proveedor =
      await prisma.suppliers.findUnique({
        where: {
          supplier_id:
            supplierId,
        },
      });

    if (!proveedor) {
      throw noEncontrado(
        'El proveedor seleccionado no existe.'
      );
    }

    /*
    * PROV-10:
    * solamente proveedores activos.
    */
    if (
      !proveedor.supplier_state
    ) {
      throw conflicto(
        `El proveedor "${proveedor.supplier_legal_name}" está inactivo.`
      );
    }

    /* ----------------------------------------------------------
      FECHAS
    ---------------------------------------------------------- */

    const fechaEmision =
      toDate(
        payload.issue_date ??
          payload.fechaEmision
      );

    if (!fechaEmision) {
      throw invalido(
        'Ingresá una fecha de emisión válida.'
      );
    }

    const fechaEsperada =
      toDate(
        payload.expected_date ??
          payload.fechaEntrega
      );

    if (
      fechaEsperada &&
      fechaEsperada <
        fechaEmision
    ) {
      throw invalido(
        'La fecha estimada de entrega no puede ser anterior a la fecha de emisión.'
      );
    }

    /* ----------------------------------------------------------
      EMPLEADO
    ---------------------------------------------------------- */

    const employeeId =
      toId(
        payload.employees_id
      ) ||
      env.DEFAULT_EMPLOYEE_ID;

    const empleado =
      await prisma.employees.findUnique({
        where: {
          employees_id:
            employeeId,
        },
      });

    if (!empleado) {
      throw invalido(
        'No se pudo identificar al empleado responsable.'
      );
    }

    /* ----------------------------------------------------------
      DETALLES
    ---------------------------------------------------------- */

    const detalles =
      payload.detalles ??
      payload.details ??
      payload.items ??
      [];

    if (
      !Array.isArray(detalles)
    ) {
      throw invalido(
        'El detalle de la orden no es válido.'
      );
    }

    const emitir =
      payload.emitir === true ||
      payload.purchase_order_status ===
        'EMITIDA';

    /*
    * Un BORRADOR puede no tener detalle.
    * Una orden EMITIDA sí necesita al menos uno.
    */
    if (
      emitir &&
      detalles.length === 0
    ) {
      throw invalido(
        'No se puede emitir una orden de compra sin artículos o servicios.'
      );
    }

    const detallesPreparados =
      [];

    for (
      let i = 0;
      i < detalles.length;
      i += 1
    ) {
      const detalle =
        detalles[i] || {};

      const articleId =
        toId(
          detalle.article_id ??
            detalle.articuloId
        );

      let descripcion =
        toText(
          detalle.item_description ??
            detalle.descripcion
        );

      const cantidad =
        toPositive(
          detalle.quantity ??
            detalle.cantidad
        );

      const precio =
        toPositive(
          detalle.unit_price ??
            detalle.precioUnitario
        );

      if (!cantidad) {
        throw invalido(
          `La cantidad del ítem ${i + 1} debe ser mayor a cero.`
        );
      }

      if (!precio) {
        throw invalido(
          `El precio unitario del ítem ${i + 1} debe ser mayor a cero.`
        );
      }

      /*
      * Artículo del catálogo.
      */
      if (articleId) {
        const articulo =
          await prisma.articles.findUnique({
            where: {
              article_id:
                articleId,
            },
          });

        if (!articulo) {
          throw noEncontrado(
            `El artículo del ítem ${i + 1} no existe.`
          );
        }

        if (!descripcion) {
          descripcion =
            articulo.article_name;
        }
      }

      /*
      * Si no tiene article_id,
      * se considera servicio/manual.
      */
      if (
        !articleId &&
        !descripcion
      ) {
        throw invalido(
          `Ingresá una descripción para el ítem ${i + 1}.`
        );
      }

      detallesPreparados.push({
        article_id:
          articleId || null,

        item_description:
          descripcion,

        quantity:
          cantidad,

        unit_price:
          precio,
      });
    }

    /* ----------------------------------------------------------
      CONDICIONES
    ---------------------------------------------------------- */

    const condicionesCompra =
      toText(
        payload.purchase_conditions ??
          payload.condicionesCompra
      );

    if (
      condicionesCompra &&
      condicionesCompra.length > 255
    ) {
      throw invalido(
        'Las condiciones de compra no pueden superar los 255 caracteres.'
      );
    }

    /* ----------------------------------------------------------
      CREACIÓN ATÓMICA
    ---------------------------------------------------------- */

    return prisma.$transaction(
      async (tx) => {
        /*
        * Número automático.
        */
        const numero =
          await generarNumeroOrden(
            tx
          );

        /*
        * Cabecera.
        */
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
                condicionesCompra,

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

        /*
        * Detalles.
        */
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

        /*
        * Si eligió Emitir:
        * BORRADOR -> EMITIDA
        */
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

        /*
        * Volvemos a consultar.
        * El trigger ya habrá calculado total_amount.
        */
        return tx.purchase_order.findUnique({
          where: {
            purchase_order_id:
              orden.purchase_order_id,
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

            status_history: {
              orderBy: {
                changed_at: 'asc',
              },
            },
          },
        });
      }
    );
  };

  /* ============================================================
    CAMBIAR ESTADO
  ============================================================ */

  const cambiarEstado = async (
    id,
    payload = {}
  ) => {
    const orderId =
      toId(id);

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
      toId(
        payload.employees_id
      ) ||
      env.DEFAULT_EMPLOYEE_ID;

    const empleado =
      await prisma.employees.findUnique({
        where: {
          employees_id:
            employeeId,
        },
      });

    if (!empleado) {
      throw invalido(
        'No se pudo identificar al empleado responsable.'
      );
    }

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

    /*
    * No se puede emitir
    * sin detalle.
    */
    if (
      nuevoEstado ===
        'EMITIDA' &&
      orden
        .purchase_order_detail
        .length === 0
    ) {
      throw invalido(
        'No se puede emitir una orden sin artículos o servicios.'
      );
    }

    /*
    * Estados finales.
    */
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
    cambiarEstado,
  };