/**
 * Autenticación por email + contraseña, con JWT de sesión para el resto de
 * la API (ver `src/api/middleware/auth.js`).
 *
 * El JWT lleva `{ sub, email, role, plan }`:
 *   - `role` ('user' | 'admin') es un privilegio de acceso propio de la cuenta
 *     (ver migración 008_auth_roles.sql) — 'admin' bypassa cualquier
 *     restricción VIP/paywall sin depender de una suscripción activa.
 *   - `plan` ('free' | 'vip') refleja el estado de facturación (Stripe, ver
 *     subscriptionService.js) y es independiente del rol.
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const defaultUserRepo = require('../repositories/userRepository');
const defaultSubscriptionRepo = require('../repositories/subscriptionRepository');

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

class AuthError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

async function computePlan(userId, subscriptionRepo) {
  const subscription = await subscriptionRepo.getByUserId(userId);
  return subscription?.plan === 'vip' && subscription?.status === 'active' ? 'vip' : 'free';
}

async function issueTokenForUser(user, { subscriptionRepo = defaultSubscriptionRepo } = {}) {
  const plan = await computePlan(user.id, subscriptionRepo);

  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role, plan }, config.api.jwtSecret, {
    expiresIn: config.api.jwtExpiresIn,
  });

  return { token, plan, role: user.role, email: user.email };
}

/** Registra una cuenta nueva (rol 'user' por defecto) y devuelve su token de sesión. */
async function registerUser(email, password, {
  userRepo = defaultUserRepo,
  subscriptionRepo = defaultSubscriptionRepo,
} = {}) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`, 'weak_password');
  }

  const existing = await userRepo.getUserByEmail(email);
  if (existing) {
    throw new AuthError('Ese email ya está registrado.', 'email_taken');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await userRepo.createUserWithPassword(email, passwordHash, 'user');
  await subscriptionRepo.upsertForUser(user.id, { plan: 'free', status: 'inactive' });

  return issueTokenForUser(user, { subscriptionRepo });
}

/** Verifica email+contraseña; devuelve el token de sesión o null si las credenciales son inválidas. */
async function login(email, password, {
  userRepo = defaultUserRepo,
  subscriptionRepo = defaultSubscriptionRepo,
} = {}) {
  const user = await userRepo.getUserByEmailWithPassword(email);
  if (!user || !user.password_hash) return null;

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  return issueTokenForUser(user, { subscriptionRepo });
}

/** Devuelve el payload decodificado, o null si el token es inválido/expiró. */
function verifySessionToken(token) {
  try {
    return jwt.verify(token, config.api.jwtSecret);
  } catch {
    return null;
  }
}

module.exports = { registerUser, login, verifySessionToken, issueTokenForUser, AuthError, MIN_PASSWORD_LENGTH };
