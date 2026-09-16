const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const config = require('../../src/config');
const { verifySessionToken } = require('../../src/services/authService');

describe('authService.verifySessionToken', () => {
  test('decodifica correctamente un token firmado con el secreto configurado', () => {
    const token = jwt.sign({ sub: 1, email: 'ana@example.com', plan: 'vip' }, config.api.jwtSecret, {
      expiresIn: '1h',
    });
    const payload = verifySessionToken(token);
    assert.equal(payload.email, 'ana@example.com');
    assert.equal(payload.plan, 'vip');
  });

  test('devuelve null para un token con firma inválida', () => {
    const token = jwt.sign({ sub: 1, email: 'ana@example.com', plan: 'vip' }, 'wrong-secret', {
      expiresIn: '1h',
    });
    assert.equal(verifySessionToken(token), null);
  });

  test('devuelve null para un token expirado', () => {
    const token = jwt.sign({ sub: 1, email: 'ana@example.com', plan: 'vip' }, config.api.jwtSecret, {
      expiresIn: -10,
    });
    assert.equal(verifySessionToken(token), null);
  });

  test('devuelve null para un string arbitrario', () => {
    assert.equal(verifySessionToken('not-a-real-token'), null);
  });
});
