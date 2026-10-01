const prisma = require('../../db/prisma');
const { conflicto, invalido, noEncontrado } = require('../../utils/AppError');
const { toId, toText, toPositive } = require('../../utils/parse');
const stockService = require('../stock/stock.service');

const CATEGORIAS = ['MINIBAR', 'GASTRONOMIA', 'LAVANDERIA', 'ESTACIONAMIENTO', 'LIMPIEZA', 'TRANSPORTE', 'OTROS'];

const categoriaValida = (value) => {
  const category = (toText(value) ?? 'OTROS').toUpperCase();
  if (!CATEGORIAS.includes(category)) throw invalido(`La categoría debe ser una de: ${CATEGORIAS.join(', ')}.`);
  return category;
};

const empleadoValido = async (tx, id) => {
  const employeeId = toId(id);
  if (!employeeId) throw invalido('El usuario responsable no es válido.');
  const employee = await tx.employees.findUnique({ where: { employees_id: employeeId } });
  if (!employee || !employee.employees_state) throw invalido('El usuario responsable no existe o está inactivo.');
  return employeeId;
};

const precioValido = (value) => {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) throw invalido('El precio del servicio debe ser mayor a cero.');
  return price;
};

const listarCatalogo = async ({ incluirInactivos = true } = {}) => prisma.$queryRaw`
  SELECT service_id, category, service_name, description, current_price, currency, active, created_at, inventory_article_id, inventory_deposit_id
  FROM "room_service_catalog"
  WHERE (${incluirInactivos}::boolean OR active = TRUE)
  ORDER BY active DESC, service_name ASC`;

const listarActivos = () => prisma.$queryRaw`
  SELECT service_id, category, service_name, description, current_price, currency, inventory_article_id, inventory_deposit_id
  FROM "room_service_catalog" WHERE active = TRUE ORDER BY service_name`;

const guardarCatalogo = async (datos = {}, employeeParam) => {
  const nombre = toText(datos.service_name ?? datos.nombre)?.replace(/\s+/g, ' ');
  const categoria = categoriaValida(datos.category ?? datos.categoria);
  const descripcion = toText(datos.description ?? datos.descripcion);
  const precio = precioValido(datos.current_price ?? datos.precio ?? datos.price);
  const moneda = (toText(datos.currency ?? datos.moneda) ?? 'ARS').toUpperCase();
  const articleId = toId(datos.inventory_article_id ?? datos.inventoryArticleId);
  const depositId = toId(datos.inventory_deposit_id ?? datos.inventoryDepositId);
  if (!nombre || nombre.length > 100) throw invalido('El nombre es obligatorio y no puede superar 100 caracteres.');
  if (descripcion && descripcion.length > 255) throw invalido('La descripción no puede superar 255 caracteres.');
  if (!/^[A-Z]{3}$/.test(moneda)) throw invalido('La moneda debe tener 3 letras, por ejemplo ARS.');
  if (categoria === 'MINIBAR' && (!articleId || !depositId)) throw invalido('Para un servicio de minibar elegí el artículo y el depósito que se descontarán del stock.');
  if (categoria !== 'MINIBAR' && (articleId || depositId)) throw invalido('El artículo y depósito de inventario solo se asignan a servicios de minibar.');
  const employeeId = await empleadoValido(prisma, employeeParam);

  return prisma.$transaction(async (tx) => {
    const [servicio] = await tx.$queryRaw`
      INSERT INTO "room_service_catalog" (category, service_name, description, current_price, currency, created_by, inventory_article_id, inventory_deposit_id)
      VALUES (${categoria}, ${nombre}, ${descripcion}, ${precio}, ${moneda}, ${employeeId}, ${articleId}, ${depositId})
      RETURNING service_id, category, service_name, description, current_price, currency, active, created_at, inventory_article_id, inventory_deposit_id`;
    await tx.$executeRaw`
      INSERT INTO "room_service_price_history" (service_id, previous_price, new_price, employees_id)
      VALUES (${servicio.service_id}, NULL, ${precio}, ${employeeId})`;
    return servicio;
  });
};

const actualizarCatalogo = async (id, datos = {}, employeeParam) => {
  const serviceId = toId(id);
  if (!serviceId) throw invalido('El servicio no es válido.');
  const employeeId = await empleadoValido(prisma, employeeParam);
  const previo = await prisma.$queryRaw`
    SELECT service_id, category, service_name, description, current_price, currency, active, inventory_article_id, inventory_deposit_id
    FROM "room_service_catalog" WHERE service_id = ${serviceId}`;
  if (!previo.length) throw noEncontrado('El servicio no existe.');
  const actual = previo[0];
  const categoria = categoriaValida(datos.category === undefined && datos.categoria === undefined
    ? actual.category : (datos.category ?? datos.categoria));
  const nombre = datos.service_name === undefined && datos.nombre === undefined
    ? actual.service_name : toText(datos.service_name ?? datos.nombre)?.replace(/\s+/g, ' ');
  const descripcion = datos.description === undefined && datos.descripcion === undefined
    ? actual.description : toText(datos.description ?? datos.descripcion);
  const precio = datos.current_price === undefined && datos.precio === undefined && datos.price === undefined
    ? Number(actual.current_price) : precioValido(datos.current_price ?? datos.precio ?? datos.price);
  const moneda = (toText(datos.currency ?? datos.moneda) ?? actual.currency).toUpperCase();
  const activo = datos.active === undefined && datos.activo === undefined
    ? actual.active : ['true', '1', 'activo'].includes(String(datos.active ?? datos.activo).toLowerCase());
  const articleId = datos.inventory_article_id === undefined && datos.inventoryArticleId === undefined ? actual.inventory_article_id : toId(datos.inventory_article_id ?? datos.inventoryArticleId);
  const depositId = datos.inventory_deposit_id === undefined && datos.inventoryDepositId === undefined ? actual.inventory_deposit_id : toId(datos.inventory_deposit_id ?? datos.inventoryDepositId);
  if (!nombre || nombre.length > 100) throw invalido('El nombre es obligatorio y no puede superar 100 caracteres.');
  if (descripcion && descripcion.length > 255) throw invalido('La descripción no puede superar 255 caracteres.');
  if (!/^[A-Z]{3}$/.test(moneda)) throw invalido('La moneda debe tener 3 letras, por ejemplo ARS.');
  if (categoria === 'MINIBAR' && (!articleId || !depositId)) throw invalido('Para un servicio de minibar elegí el artículo y el depósito que se descontarán del stock.');
  if (categoria !== 'MINIBAR' && (articleId || depositId)) throw invalido('El artículo y depósito de inventario solo se asignan a servicios de minibar.');

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "room_service_catalog"
      SET category = ${categoria}, service_name = ${nombre}, description = ${descripcion}, current_price = ${precio}, currency = ${moneda}, active = ${activo}, inventory_article_id = ${articleId}, inventory_deposit_id = ${depositId}
      WHERE service_id = ${serviceId}`;
    if (Number(actual.current_price) !== precio) {
      await tx.$executeRaw`
        INSERT INTO "room_service_price_history" (service_id, previous_price, new_price, employees_id)
        VALUES (${serviceId}, ${Number(actual.current_price)}, ${precio}, ${employeeId})`;
    }
    const [actualizado] = await tx.$queryRaw`
      SELECT service_id, category, service_name, description, current_price, currency, active, created_at, inventory_article_id, inventory_deposit_id
      FROM "room_service_catalog" WHERE service_id = ${serviceId}`;
    return actualizado;
  });
};

const historialPrecios = async (id) => {
  const serviceId = toId(id);
  if (!serviceId) throw invalido('El servicio no es válido.');
  return prisma.$queryRaw`
    SELECT h.price_history_id, h.previous_price, h.new_price, h.valid_from,
           e.employees_name, e.employees_lastname
    FROM "room_service_price_history" h
    JOIN "employees" e ON e.employees_id = h.employees_id
    WHERE h.service_id = ${serviceId}
    ORDER BY h.valid_from DESC, h.price_history_id DESC`;
};

const habitacionesOcupadas = () => prisma.$queryRaw`
  SELECT r.room_id, r.room_number, res.reservation_id, res.reservation_code,
         g.first_name AS guest_first_name, g.last_name AS guest_last_name
  FROM "reservation" res
  JOIN "room" r ON r.room_id = res.room_id
  JOIN "guest" g ON g.guest_id = res.guest_id
  WHERE res.reservation_status = 'IN_HOUSE' AND r.active = TRUE
  ORDER BY r.room_number`;

const validarEstadiaActiva = async (tx, roomId, reservationId) => {
  const filas = await tx.$queryRaw`
    SELECT reservation_id FROM "reservation"
    WHERE room_id = ${roomId} AND reservation_status = 'IN_HOUSE'
    FOR UPDATE`;
  if (!filas.length) throw conflicto('Solo se pueden cargar servicios a la habitación ocupada durante una estadía activa.');
  if (filas.length !== 1) throw conflicto('La habitación tiene más de una estadía activa. Revisá sus reservas antes de cargar servicios.');
  const actual = filas[0].reservation_id;
  if (reservationId != null && reservationId !== actual) {
    throw conflicto('La estadía de la habitación cambió. Actualizá la lista de habitaciones antes de continuar.');
  }
  return actual;
};

const listarCargos = async (roomParam, reservationParam) => {
  const roomId = toId(roomParam);
  const esperada = reservationParam === undefined ? null : toId(reservationParam);
  if (!roomId || (reservationParam !== undefined && !esperada)) throw invalido('Elegí una habitación y estadía válidas.');
  return prisma.$transaction(async (tx) => {
    const reservationId = await validarEstadiaActiva(tx, roomId, esperada);
    return tx.$queryRaw`
    SELECT c.charge_id, c.reservation_id, c.room_id, c.service_id, c.service_name,
           c.quantity, c.unit_price, c.total_amount, c.charged_at, c.paid_at,
           c.payment_reference, pm.payment_method,
           e.employees_name, e.employees_lastname
    FROM "room_service_charge" c
    JOIN "employees" e ON e.employees_id = c.employees_id
    LEFT JOIN "payment_method" pm ON pm.payment_method_id = c.payment_method_id
    WHERE c.room_id = ${roomId} AND c.reservation_id = ${reservationId}
    ORDER BY c.charged_at DESC, c.charge_id DESC`;
  });
};

const cargarCargo = async (roomParam, { reservationId: legacyReservation, expectedReservationId, serviceId: serviceParam, quantity = 1 } = {}, employeeParam) => {
  const roomId = toId(roomParam);
  const reservationParam = expectedReservationId ?? legacyReservation;
  const esperada = reservationParam === undefined ? null : toId(reservationParam);
  const serviceId = toId(serviceParam);
  const cantidad = toPositive(quantity);
  if (!roomId || !serviceId || (reservationParam !== undefined && !esperada)) throw invalido('Elegí una habitación y servicio válidos.');
  if (!cantidad || cantidad > 100) throw invalido('La cantidad debe ser un entero entre 1 y 100.');
  const employeeId = await empleadoValido(prisma, employeeParam);

  return prisma.$transaction(async (tx) => {
    const reservationId = await validarEstadiaActiva(tx, roomId, esperada);
    const servicios = await tx.$queryRaw`
      SELECT service_id, category, service_name, current_price, inventory_article_id, inventory_deposit_id FROM "room_service_catalog"
      WHERE service_id = ${serviceId} AND active = TRUE`;
    if (!servicios.length) throw noEncontrado('El servicio no existe o está inactivo.');
    const servicio = servicios[0];
    if (servicio.category === 'MINIBAR') {
      if (!servicio.inventory_article_id || !servicio.inventory_deposit_id) throw conflicto('Este minibar no tiene artículo y depósito de stock configurados. Editá el servicio antes de cargar consumos.');
      await stockService.registrarConsumoEnTransaccion(tx, {
        articleId: Number(servicio.inventory_article_id), depositId: Number(servicio.inventory_deposit_id), quantity: cantidad,
        employeeId, observations: `Consumo minibar ${servicio.service_name} · estadía ${reservationId}`,
      });
    }
    const [cargo] = await tx.$queryRaw`
      INSERT INTO "room_service_charge" (
        reservation_id, room_id, service_id, service_name, quantity, unit_price, employees_id
      ) VALUES (
        ${reservationId}, ${roomId}, ${serviceId}, ${servicio.service_name}, ${cantidad}, ${servicio.current_price}, ${employeeId}
      ) RETURNING charge_id, reservation_id, room_id, service_id, service_name,
                quantity, unit_price, total_amount, charged_at, paid_at`;
    return cargo;
  });
};

const cobrarCargo = async (id, { paymentMethodId: methodParam, paymentReference: referenceParam } = {}, employeeParam) => {
  const chargeId = toId(id);
  if (!chargeId) throw invalido('El cargo no es válido.');
  const employeeId = await empleadoValido(prisma, employeeParam);
  const methodId = toId(methodParam);
  if (!methodId) throw invalido('Elegí el medio de pago.');
  const metodo = await prisma.payment_method.findUnique({ where: { payment_method_id: methodId } });
  if (!metodo || !metodo.active) throw invalido('El medio de pago no existe o está inactivo.');
  const referencia = toText(referenceParam);
  if (metodo.requires_reference && !referencia) throw invalido('Este medio de pago requiere número de referencia.');
  const actualizado = await prisma.$queryRaw`
    UPDATE "room_service_charge" SET paid_at = CURRENT_TIMESTAMP, paid_by = ${employeeId}, payment_method_id = ${methodId}, payment_reference = ${referencia}
    WHERE charge_id = ${chargeId} AND paid_at IS NULL
    RETURNING charge_id, reservation_id, room_id, service_id, service_name,
              quantity, unit_price, total_amount, charged_at, paid_at`;
  if (!actualizado.length) throw conflicto('El cargo no existe o ya fue cobrado.');
  return actualizado[0];
};

module.exports = {
  listarCatalogo, listarActivos, guardarCatalogo, actualizarCatalogo, historialPrecios,
  habitacionesOcupadas, listarCargos, cargarCargo, cobrarCargo,
};
