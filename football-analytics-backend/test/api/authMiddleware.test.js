const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { hasFullAccess, requireVip, requireAdmin, requireAuth } = require('../../src/api/middleware/auth');

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

describe('hasFullAccess', () => {
  test('un admin tiene acceso total sin importar el plan', () => {
    assert.equal(hasFullAccess({ role: 'admin', plan: 'free' }), true);
  });

  test('un usuario vip tiene acceso total', () => {
    assert.equal(hasFullAccess({ role: 'user', plan: 'vip' }), true);
  });

  test('un usuario free sin rol admin no tiene acceso total', () => {
    assert.equal(hasFullAccess({ role: 'user', plan: 'free' }), false);
  });

  test('sin usuario (no autenticado) no tiene acceso total', () => {
    assert.equal(hasFullAccess(undefined), false);
  });
});

describe('requireVip middleware', () => {
  test('deja pasar a un admin con plan free', () => {
    const req = { user: { role: 'admin', plan: 'free' } };
    const res = mockRes();
    let nextCalled = false;
    requireVip(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, null);
  });

  test('bloquea con 402 a un usuario free', () => {
    const req = { user: { role: 'user', plan: 'free' } };
    const res = mockRes();
    let nextCalled = false;
    requireVip(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 402);
    assert.equal(res.body.error, 'vip_required');
  });
});

describe('requireAdmin middleware', () => {
  test('deja pasar solo a role="admin"', () => {
    const req = { user: { role: 'admin', plan: 'vip' } };
    const res = mockRes();
    let nextCalled = false;
    requireAdmin(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  test('bloquea con 403 a un usuario vip que no es admin', () => {
    const req = { user: { role: 'user', plan: 'vip' } };
    const res = mockRes();
    let nextCalled = false;
    requireAdmin(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'admin_required');
  });
});

describe('requireAuth middleware', () => {
  test('bloquea con 401 si no hay usuario en la request', () => {
    const req = {};
    const res = mockRes();
    let nextCalled = false;
    requireAuth(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });

  test('deja pasar si hay cualquier usuario autenticado', () => {
    const req = { user: { role: 'user', plan: 'free' } };
    const res = mockRes();
    let nextCalled = false;
    requireAuth(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });
});
