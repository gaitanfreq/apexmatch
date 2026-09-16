#!/usr/bin/env node
/**
 * Crea (o actualiza) la cuenta de Administrador/Creador: rol 'admin' con
 * acceso ilimitado a todo el sistema, sin depender de una suscripción Stripe.
 *
 * Lee ADMIN_EMAIL / ADMIN_PASSWORD de .env. Idempotente: si el email ya
 * existe, solo actualiza su contraseña y fuerza role='admin'.
 *
 * Uso: npm run seed:admin
 */
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db/pool');
const config = require('../src/config');
const logger = require('../src/utils/logger');
const userRepo = require('../src/repositories/userRepository');
const subscriptionRepo = require('../src/repositories/subscriptionRepository');

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

async function main() {
  const { email, password } = config.admin;

  if (!email || !password) {
    logger.error('ADMIN_EMAIL y ADMIN_PASSWORD deben estar seteados en .env para crear la cuenta admin.');
    process.exitCode = 1;
    return;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    logger.error(`ADMIN_PASSWORD debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await userRepo.upsertAdminUser(email, passwordHash);

  // El admin también queda marcado como VIP a nivel de suscripción (informativo:
  // el rol 'admin' ya bypassa cualquier chequeo de plan, ver hasFullAccess()).
  await subscriptionRepo.upsertForUser(user.id, { plan: 'vip', status: 'active' });

  logger.info(`Cuenta admin lista: ${user.email} (id=${user.id}, role=${user.role}).`);
}

main()
  .catch((err) => {
    logger.error('No se pudo crear la cuenta admin', { error: err.message });
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
