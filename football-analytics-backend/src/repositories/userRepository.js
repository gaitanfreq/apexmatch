const { query } = require('../db/pool');

async function upsertUserByEmail(email) {
  const { rows } = await query(
    `INSERT INTO users (email) VALUES ($1)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id, email, role, created_at`,
    [email]
  );
  return rows[0];
}

/** Crea un usuario nuevo con contraseña ya hasheada. Falla (constraint UNIQUE) si el email ya existe. */
async function createUserWithPassword(email, passwordHash, role = 'user') {
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)
     RETURNING id, email, role, created_at`,
    [email, passwordHash, role]
  );
  return rows[0];
}

async function getUserByEmail(email) {
  const { rows } = await query('SELECT id, email, role, created_at FROM users WHERE email = $1', [email]);
  return rows[0] ?? null;
}

/** Incluye password_hash — solo para verificación de credenciales en el login, nunca exponer via API. */
async function getUserByEmailWithPassword(email) {
  const { rows } = await query(
    'SELECT id, email, role, password_hash, created_at FROM users WHERE email = $1',
    [email]
  );
  return rows[0] ?? null;
}

async function getUserById(id) {
  const { rows } = await query('SELECT id, email, role, created_at FROM users WHERE id = $1', [id]);
  return rows[0] ?? null;
}

/** Upsert atómico de la cuenta admin/creador: crea el usuario si no existe y fuerza su rol y contraseña. */
async function upsertAdminUser(email, passwordHash) {
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin'
     RETURNING id, email, role, created_at`,
    [email, passwordHash]
  );
  return rows[0];
}

/** Cambia el rol de acceso de una cuenta ('user' | 'admin') — usado por el panel de administración. */
async function updateRole(userId, role) {
  const { rows } = await query(
    'UPDATE users SET role = $2 WHERE id = $1 RETURNING id, email, role, created_at',
    [userId, role]
  );
  return rows[0] ?? null;
}

/** Contadores agregados para las métricas rápidas del panel de administración. */
async function getSystemStats() {
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*) FROM users)::int AS "totalUsers",
       (SELECT COUNT(*) FROM subscriptions WHERE plan = 'vip' AND status = 'active')::int AS "activeVipUsers",
       (SELECT COUNT(*) FROM user_bets)::int AS "totalBets"`
  );
  return rows[0];
}

/** Listado para el panel de administración: usuarios + su plan/estado de suscripción actual. */
async function listUsersWithSubscriptions({ limit = 100 } = {}) {
  const { rows } = await query(
    `SELECT u.id, u.email, u.role, u.created_at,
            s.plan, s.status AS subscription_status, s.current_period_end
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     ORDER BY u.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

module.exports = {
  upsertUserByEmail,
  createUserWithPassword,
  getUserByEmail,
  getUserByEmailWithPassword,
  getUserById,
  upsertAdminUser,
  updateRole,
  getSystemStats,
  listUsersWithSubscriptions,
};
