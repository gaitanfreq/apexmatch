const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { validate } = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');
const { userIdParam, updateUserTierBody } = require('../schemas');
const userRepo = require('../../repositories/userRepository');
const subscriptionRepo = require('../../repositories/subscriptionRepository');

const router = express.Router();

// Todas las rutas de este router requieren rol 'admin' — ver requireAdmin.
router.use(requireAdmin);

/** Traduce el nivel de acceso elegido en el panel a los campos reales de la base. */
function resolveTierFields(tier) {
  return {
    role: tier === 'admin' ? 'admin' : 'user',
    plan: tier === 'free' ? 'free' : 'vip',
    status: tier === 'free' ? 'inactive' : 'active',
  };
}

function toApiUser(u) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    plan: u.plan ?? 'free',
    subscriptionStatus: u.subscription_status ?? 'inactive',
    currentPeriodEnd: u.current_period_end,
    createdAt: u.created_at,
  };
}

/**
 * GET /api/admin/users
 * Listado de cuentas registradas con su rol y plan de suscripción actual,
 * más las métricas rápidas del panel (total de usuarios, VIP activos, total
 * de apuestas registradas en el sistema). Herramienta exclusiva del rol ADMIN.
 */
router.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const [users, stats] = await Promise.all([userRepo.listUsersWithSubscriptions(), userRepo.getSystemStats()]);
    res.json({ count: users.length, users: users.map(toApiUser), stats });
  })
);

/**
 * PATCH /api/admin/users/:id
 * Cambia el nivel de acceso de una cuenta: 'free' | 'vip' | 'admin'.
 *   - 'admin'  -> role='admin' (bypassa todo, ver hasFullAccess) + plan='vip'/'active'.
 *   - 'vip'    -> role='user'  + plan='vip'/'active' (VIP otorgado manualmente, sin Stripe).
 *   - 'free'   -> role='user'  + plan='free'/'inactive'.
 * No permite que un admin se quite su propio rol de administrador desde acá
 * (evita un auto-bloqueo accidental sin otro admin que lo revierta).
 */
router.patch(
  '/users/:id',
  validate({ params: userIdParam, body: updateUserTierBody }),
  asyncHandler(async (req, res) => {
    const { id: targetUserId } = req.params;
    const { tier } = req.body;

    if (targetUserId === req.user.id && tier !== 'admin') {
      return res.status(400).json({
        error: 'self_demote_forbidden',
        message: 'No podés quitarte tu propio rol de administrador desde el panel.',
      });
    }

    const targetUser = await userRepo.getUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'not_found', message: 'Usuario no encontrado.' });
    }

    const { role, plan, status } = resolveTierFields(tier);

    await userRepo.updateRole(targetUserId, role);
    await subscriptionRepo.upsertForUser(targetUserId, { plan, status });

    const [users, stats] = await Promise.all([userRepo.listUsersWithSubscriptions(), userRepo.getSystemStats()]);
    const updated = users.find((u) => u.id === targetUserId);

    res.json({ user: toApiUser(updated), stats });
  })
);

module.exports = router;
module.exports.resolveTierFields = resolveTierFields;
