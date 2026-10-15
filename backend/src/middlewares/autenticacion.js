const { verificarToken } = require('../modules/auth/auth.service');

function autenticar(req, res, next) {
  const autorizacion = req.get('authorization') || '';
  const coincidencia = /^Bearer\s+(.+)$/i.exec(autorizacion);
  const usuario = coincidencia ? verificarToken(coincidencia[1]) : null;
  if (!usuario) return res.status(401).json({ ok: false, message: 'La sesión venció o no es válida. Volvé a iniciar sesión.' });
  req.user = usuario;
  next();
}

const ACCESO_POR_ROL = {
  ENCARGADO_STOCK: [
    '/depositos', '/articulos', '/categorias', '/stock', '/tipos-movimiento', '/catalogo',
    '/proveedores', '/condiciones-fiscales', '/tipos-comprobante', '/comprobantes',
    '/metodos-pago', '/ordenes-pago', '/ordenes-compra', '/cuenta-corriente',
  ],
  GOBERNANZA: ['/housekeeping', '/mantenimiento', '/panel-habitaciones'],
  RECEPCION: ['/reservas', '/panel-habitaciones', '/servicios-habitacion', '/metodos-pago'],
};

function rutaPermitida(rol, ruta, metodo) {
  // Gerencia puede operar todos los módulos disponibles; administración
  // conserva el acceso irrestricto para futuras funciones administrativas.
  if (rol === 'ADMINISTRADOR' || rol === 'GERENTE') return true;
  const prefijos = ACCESO_POR_ROL[rol] || [];
  if (!prefijos.some((prefijo) => ruta === prefijo || ruta.startsWith(`${prefijo}/`))) return false;

  if (rol === 'RECEPCION') {
    if (ruta === '/metodos-pago' || ruta.startsWith('/metodos-pago/')) return metodo === 'GET';
    if (ruta.startsWith('/servicios-habitacion/catalogo')) return false;
    if (ruta.startsWith('/servicios-habitacion/habitaciones/')) return metodo === 'GET' || metodo === 'POST';
    if (ruta.startsWith('/servicios-habitacion/cargos/')) return metodo === 'PATCH';
  }
  return true;
}

function autenticarYAutorizar(req, res, next) {
  autenticar(req, res, (error) => {
    if (error) return next(error);
    const ruta = req.originalUrl.split('?')[0].replace(/^\/api/, '') || '/';
    if (!rutaPermitida(req.user.rol, ruta, req.method)) {
      return res.status(403).json({ ok: false, message: 'Tu rol no tiene permiso para acceder a este módulo.' });
    }
    // La identidad para auditoría proviene de la sesión, no del formulario.
    if (req.body && typeof req.body === 'object') {
      for (const campo of ['employeeId', 'usuarioRecepcionId', 'employees_id']) {
        if (campo in req.body) req.body[campo] = req.user.employees_id;
      }
    }
    next();
  });
}

module.exports = { autenticar, autenticarYAutorizar };
