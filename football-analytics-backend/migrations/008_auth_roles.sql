-- ============================================================================
-- 008_auth_roles.sql
-- Autenticación real (email + contraseña) y rol de autorización por usuario.
--
-- `role` es independiente de `subscriptions.plan`: `plan` (free/vip) refleja
-- el estado de facturación (Stripe), mientras que `role` es un privilegio de
-- acceso ('admin' bypassa cualquier restricción VIP/paywall, sin depender de
-- una suscripción activa). Ver src/api/middleware/auth.js (hasFullAccess).
-- ============================================================================

ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN role VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));

CREATE INDEX idx_users_role ON users(role);
