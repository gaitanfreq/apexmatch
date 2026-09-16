const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { resolveTierFields } = require('../../src/api/routes/admin');

describe('admin.resolveTierFields', () => {
  test("'admin' -> role admin, plan vip activo", () => {
    assert.deepEqual(resolveTierFields('admin'), { role: 'admin', plan: 'vip', status: 'active' });
  });

  test("'vip' -> role user, plan vip activo", () => {
    assert.deepEqual(resolveTierFields('vip'), { role: 'user', plan: 'vip', status: 'active' });
  });

  test("'free' -> role user, plan free inactivo", () => {
    assert.deepEqual(resolveTierFields('free'), { role: 'user', plan: 'free', status: 'inactive' });
  });
});
