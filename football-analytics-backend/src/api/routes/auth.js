const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { validate } = require('../middleware/validate');
const { credentialsBody } = require('../schemas');
const authService = require('../../services/authService');

const router = express.Router();

/**
 * POST /api/auth/register
 * Crea una cuenta nueva (rol 'user', plan 'free') y devuelve un JWT de sesión.
 * Usado como backend de credenciales por el proveedor Credentials de NextAuth
 * en el frontend (ver football-analytics-frontend/lib/authOptions.js).
 */
router.post(
  '/register',
  validate({ body: credentialsBody }),
  asyncHandler(async (req, res) => {
    try {
      const { email, password } = req.body;
      const result = await authService.registerUser(email, password);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof authService.AuthError) {
        return res.status(409).json({ error: err.code, message: err.message });
      }
      throw err;
    }
  })
);

/**
 * POST /api/auth/login
 * Verifica email + contraseña y devuelve un JWT de sesión reflejando el rol
 * ('user'/'admin') y el plan ('free'/'vip') actuales del usuario.
 */
router.post(
  '/login',
  validate({ body: credentialsBody }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    if (!result) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'Email o contraseña incorrectos.' });
    }

    res.json(result);
  })
);

module.exports = router;
