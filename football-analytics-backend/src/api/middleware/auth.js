const { verifySessionToken } = require('../../services/authService');

/** Decodifica el JWT (si viene) y lo adjunta a req.user; nunca bloquea la request. */
function attachUser(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme === 'Bearer' && token) {
    const payload = verifySessionToken(token);
    if (payload) {
      req.user = { id: payload.sub, email: payload.email, role: payload.role, plan: payload.plan };
    }
  }
  next();
}

/** El rol 'admin' (creador/superusuario) tiene acceso total, sin depender del plan de suscripción. */
function hasFullAccess(user) {
  return user?.role === 'admin' || user?.plan === 'vip';
}

/** Bloquea el acceso si el usuario no es admin y no tiene un plan VIP activo. */
function requireVip(req, res, next) {
  if (hasFullAccess(req.user)) return next();

  return res.status(402).json({
    error: 'vip_required',
    message: 'Este contenido requiere una suscripción VIP activa.',
    upgradeUrl: '/api/subscriptions/checkout',
  });
}

/** Bloquea el acceso a rutas de administración a cualquiera que no tenga rol 'admin'. */
function requireAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();

  return res.status(403).json({
    error: 'admin_required',
    message: 'Esta sección requiere una cuenta de administrador.',
  });
}

/** Bloquea el acceso si no hay una sesión válida (cualquier usuario autenticado). */
function requireAuth(req, res, next) {
  if (req.user) return next();

  return res.status(401).json({ error: 'unauthorized', message: 'Se requiere iniciar sesión.' });
}

module.exports = { attachUser, requireVip, requireAdmin, requireAuth, hasFullAccess };
