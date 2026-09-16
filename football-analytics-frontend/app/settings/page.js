'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import RoleBadge, { effectiveRole } from '@/components/RoleBadge';
import { api } from '@/lib/api';

/** Settings: estado de la cuenta autenticada (protegida por middleware.js) y gestión de plan/sesión. */
export default function SettingsPage() {
  const { data: session } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!session) return null; // middleware ya redirige a /login; evita un flash sin datos

  const role = effectiveRole(session.user);
  const hasFullAccess = role === 'ADMIN' || role === 'VIP';

  async function handleUpgrade() {
    setBusy(true);
    setError(null);
    try {
      const { checkoutUrl } = await api.createCheckoutSession(session.user.email);
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="pt-4">
        <span className="badge bg-electric-blue/15 text-electric-blue">Settings</span>
        <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Tu Cuenta</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">Gestiona tu sesión y tu plan de suscripción.</p>
      </section>

      <div className="card max-w-md p-6">
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-muted">Email</p>
            <p className="text-sm text-white">{session.user.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-muted">Rol / Plan</p>
            <RoleBadge role={role} className="mt-1" />
            {role === 'ADMIN' && (
              <p className="mt-1 text-xs text-ink-muted">Acceso ilimitado a todo el sistema, incluyendo VIP y Admin.</p>
            )}
          </div>

          {error && <p className="text-xs text-neon-magenta">{error}</p>}

          {!hasFullAccess && (
            <button
              onClick={handleUpgrade}
              disabled={busy}
              className="w-full rounded-lg bg-neon-magenta px-3 py-2 text-sm font-semibold text-[#0b0e14] shadow-glow-magenta hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Redirigiendo a Stripe...' : 'Unlock VIP Access'}
            </button>
          )}

          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full rounded-lg border border-[#232b3e] bg-black/20 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
