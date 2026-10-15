const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../../db/prisma');
const env = require('../../config/env');
const { AppError, invalido } = require('../../utils/AppError');

const DURACION_TOKEN_SEGUNDOS = 8 * 60 * 60;
const HASH_SEMILLA_DESARROLLO = '$2b$10$3euPcmQFCiblsZeEu5s7p.9OVHgeHWFxCiWFzoOOOOOOOOOOOOOOO';
const ALIAS_ROLES = {
  ADMIN: 'ADMINISTRADOR', ADMINISTRADOR: 'ADMINISTRADOR',
  GERENTE: 'GERENTE', GERENCIA: 'GERENTE',
  STOCK: 'ENCARGADO_STOCK', ENCARGADO_STOCK: 'ENCARGADO_STOCK',
  GOBERNANZA: 'GOBERNANZA', RECEPCION: 'RECEPCION',
};

function crearToken(usuario) {
  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const carga = Buffer.from(JSON.stringify({
    sub: usuario.employees_id,
    rol: usuario.rol,
    nombre: usuario.nombre,
    email: usuario.email,
    iat: ahora,
    exp: ahora + DURACION_TOKEN_SEGUNDOS,
  })).toString('base64url');
  const contenido = `${cabecera}.${carga}`;
  const firma = crypto.createHmac('sha256', env.AUTH_TOKEN_SECRET).update(contenido).digest('base64url');
  return `${contenido}.${firma}`;
}

function compararFirma(esperada, recibida) {
  const a = Buffer.from(esperada);
  const b = Buffer.from(recibida);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verificarToken(token) {
  if (typeof token !== 'string' || token.length > 4096) return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const contenido = `${partes[0]}.${partes[1]}`;
  const firma = crypto.createHmac('sha256', env.AUTH_TOKEN_SECRET).update(contenido).digest('base64url');
  if (!compararFirma(firma, partes[2])) return null;
  try {
    const carga = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'));
    if (!Number.isInteger(carga.sub) || !carga.rol || !Number.isInteger(carga.exp) || carga.exp <= Date.now() / 1000) return null;
    return { employees_id: carga.sub, rol: carga.rol, nombre: carga.nombre, email: carga.email };
  } catch {
    return null;
  }
}

async function iniciarSesion(usuarioIngresado, contrasena) {
  const usuario = typeof usuarioIngresado === 'string' ? usuarioIngresado.trim() : '';
  if (!usuario || usuario.length > 150 || typeof contrasena !== 'string' || !contrasena || contrasena.length > 200) {
    throw invalido('Ingresá tu usuario y contraseña.');
  }

  let empleado;
  if (usuario.includes('@')) {
    empleado = await prisma.employees.findFirst({
      where: { employees_email: { equals: usuario, mode: 'insensitive' }, employees_state: true },
      include: { roles: true },
    });
  } else {
    const alias = usuario.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
    const nombreRol = ALIAS_ROLES[alias];
    if (nombreRol) {
      const rol = await prisma.roles.findFirst({
        where: { rol_name: nombreRol, rol_state: true },
        include: { employees: { where: { employees_state: true }, orderBy: { employees_id: 'asc' }, take: 1 } },
      });
      empleado = rol?.employees[0] ? { ...rol.employees[0], roles: rol } : null;
    }
  }

  if (!empleado?.roles?.rol_state) throw new AppError('Usuario o contraseña incorrectos, o cuenta inactiva.', 401);
  let valida = await bcrypt.compare(contrasena, empleado.roles.rol_pass);

  // El hash histórico de 02_seed.sql es un marcador inválido. En desarrollo,
  // permite el acceso documentado (1234) una sola vez y lo reemplaza por bcrypt válido.
  if (!valida && env.NODE_ENV !== 'production' && contrasena === '1234' && empleado.roles.rol_pass === HASH_SEMILLA_DESARROLLO) {
    const hash = await bcrypt.hash(contrasena, 10);
    const rolActualizado = await prisma.roles.update({
      where: { rol_id: empleado.roles.rol_id },
      data: { rol_pass: hash },
    });
    empleado.roles.rol_pass = rolActualizado.rol_pass;
    valida = true;
  }

  if (!valida) throw new AppError('Usuario o contraseña incorrectos, o cuenta inactiva.', 401);

  const usuarioAutenticado = {
    employees_id: empleado.employees_id,
    rol: empleado.roles.rol_name,
    nombre: `${empleado.employees_name} ${empleado.employees_lastname}`,
    email: empleado.employees_email,
  };
  return { token: crearToken(usuarioAutenticado), usuario: usuarioAutenticado, expira_en_segundos: DURACION_TOKEN_SEGUNDOS };
}

module.exports = { iniciarSesion, verificarToken };
