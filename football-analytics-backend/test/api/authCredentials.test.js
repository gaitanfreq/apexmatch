/**
 * Prueba `registerUser`/`login` inyectando repos en memoria (fakes), sin
 * tocar la base de datos real — valida el hasheo de contraseña, el rechazo
 * de emails duplicados, la verificación de credenciales y que el rol viaje
 * correctamente dentro del JWT emitido.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const config = require('../../src/config');
const { registerUser, login, AuthError } = require('../../src/services/authService');

function createFakeRepos() {
  const users = [];
  const subscriptions = [];
  let nextId = 1;

  const userRepo = {
    async getUserByEmail(email) {
      return users.find((u) => u.email === email) ?? null;
    },
    async getUserByEmailWithPassword(email) {
      return users.find((u) => u.email === email) ?? null;
    },
    async createUserWithPassword(email, passwordHash, role) {
      const user = { id: nextId++, email, password_hash: passwordHash, role, created_at: new Date() };
      users.push(user);
      return { id: user.id, email: user.email, role: user.role, created_at: user.created_at };
    },
  };

  const subscriptionRepo = {
    async getByUserId(userId) {
      return subscriptions.find((s) => s.user_id === userId) ?? null;
    },
    async upsertForUser(userId, patch) {
      let sub = subscriptions.find((s) => s.user_id === userId);
      if (!sub) {
        sub = { user_id: userId };
        subscriptions.push(sub);
      }
      Object.assign(sub, patch);
      return sub;
    },
  };

  return { userRepo, subscriptionRepo, users, subscriptions };
}

describe('authService.registerUser', () => {
  test('crea la cuenta con rol "user" y plan "free" por defecto', async () => {
    const { userRepo, subscriptionRepo } = createFakeRepos();
    const result = await registerUser('ana@example.com', 'supersecret123', { userRepo, subscriptionRepo });

    assert.equal(result.role, 'user');
    assert.equal(result.plan, 'free');
    assert.equal(result.email, 'ana@example.com');
    assert.ok(result.token);
  });

  test('la contraseña queda hasheada, nunca en texto plano', async () => {
    const { userRepo, subscriptionRepo, users } = createFakeRepos();
    await registerUser('ana@example.com', 'supersecret123', { userRepo, subscriptionRepo });

    assert.notEqual(users[0].password_hash, 'supersecret123');
    assert.ok(users[0].password_hash.startsWith('$2')); // formato bcrypt
  });

  test('rechaza contraseñas menores a 8 caracteres', async () => {
    const { userRepo, subscriptionRepo } = createFakeRepos();
    await assert.rejects(
      () => registerUser('ana@example.com', 'short', { userRepo, subscriptionRepo }),
      AuthError
    );
  });

  test('rechaza un email ya registrado', async () => {
    const { userRepo, subscriptionRepo } = createFakeRepos();
    await registerUser('ana@example.com', 'supersecret123', { userRepo, subscriptionRepo });

    await assert.rejects(
      () => registerUser('ana@example.com', 'otherpassword1', { userRepo, subscriptionRepo }),
      (err) => {
        assert.ok(err instanceof AuthError);
        assert.equal(err.code, 'email_taken');
        return true;
      }
    );
  });

  test('el JWT emitido contiene sub, email, role y plan', async () => {
    const { userRepo, subscriptionRepo } = createFakeRepos();
    const result = await registerUser('ana@example.com', 'supersecret123', { userRepo, subscriptionRepo });

    const payload = jwt.verify(result.token, config.api.jwtSecret);
    assert.equal(payload.email, 'ana@example.com');
    assert.equal(payload.role, 'user');
    assert.equal(payload.plan, 'free');
    assert.equal(typeof payload.sub, 'number');
  });
});

describe('authService.login', () => {
  test('devuelve un token cuando la contraseña es correcta', async () => {
    const { userRepo, subscriptionRepo } = createFakeRepos();
    await registerUser('ana@example.com', 'supersecret123', { userRepo, subscriptionRepo });

    const result = await login('ana@example.com', 'supersecret123', { userRepo, subscriptionRepo });
    assert.ok(result);
    assert.equal(result.email, 'ana@example.com');
  });

  test('devuelve null con la contraseña incorrecta', async () => {
    const { userRepo, subscriptionRepo } = createFakeRepos();
    await registerUser('ana@example.com', 'supersecret123', { userRepo, subscriptionRepo });

    const result = await login('ana@example.com', 'wrong-password', { userRepo, subscriptionRepo });
    assert.equal(result, null);
  });

  test('devuelve null para un email que no existe', async () => {
    const { userRepo, subscriptionRepo } = createFakeRepos();
    const result = await login('nadie@example.com', 'whatever123', { userRepo, subscriptionRepo });
    assert.equal(result, null);
  });

  test('un usuario admin con suscripción vip activa recibe role="admin" y plan="vip" en el token', async () => {
    const { userRepo, subscriptionRepo } = createFakeRepos();
    const registered = await registerUser('creator@example.com', 'supersecret123', { userRepo, subscriptionRepo });
    // Simula lo que hace scripts/seed-admin.js: forzar role y plan tras el registro.
    const user = await userRepo.getUserByEmail('creator@example.com');
    user.role = 'admin';
    await subscriptionRepo.upsertForUser(user.id, { plan: 'vip', status: 'active' });

    const result = await login('creator@example.com', 'supersecret123', { userRepo, subscriptionRepo });
    const payload = jwt.verify(result.token, config.api.jwtSecret);
    assert.equal(payload.role, 'admin');
    assert.equal(payload.plan, 'vip');
    void registered;
  });
});
