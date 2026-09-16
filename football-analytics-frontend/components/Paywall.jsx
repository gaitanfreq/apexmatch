'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import ApexMatchLogo from './ui/ApexMatchLogo';
import { effectiveRole } from './RoleBadge';
import { api } from '@/lib/api';

/**
 * Muro de pago VIP: bloquea visualmente el contenido detrás (value bets,
 * marcadores exactos) con vidrio esmerilado y borde magenta neón.
 *
 * `/vip` ya está protegida por middleware.js (redirige a /login si no hay
 * sesión), así que aquí siempre hay un usuario autenticado — el único caso a
 * resolver es "autenticado pero sin acceso completo" (FREE), ofreciendo el
 * checkout de Stripe directamente con su email de sesión.
 */
export default function Paywall({ children }) {
  const { data: session, status } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (status === 'loading') return null;

  const role = effectiveRole(session?.user);
  if (role === 'ADMIN' || role === 'VIP') return children;

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
    <div className="relative overflow-hidden rounded-2xl border border-neon-magenta/40 bg-[#141923]/80 p-8 text-center shadow-glow-magenta backdrop-blur-lg">
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] blur-sm">{children}</div>
      <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-neon-magenta/15 blur-3xl" />

      <div className="relative mx-auto max-w-sm">
        <div className="mx-auto mb-4">
          <ApexMatchLogo variant="vip" size="lg" />
        </div>

        <span className="badge mb-3 bg-neon-magenta/15 text-neon-magenta glow-text-magenta">Edge: +7.5%</span>
        <h3 className="mb-2 text-lg font-semibold text-white">
          Desbloquea Value Bets y marcadores exactos
        </h3>
        <p className="mb-6 text-sm text-ink-muted">
          Nuestro motor de Poisson Bivariada detecta cuotas con edge &gt; 5% sobre las casas de apuestas.
          Suscríbete al plan VIP para acceder en tiempo real, {session.user.email}.
        </p>

        {error && <p className="mb-3 text-xs text-neon-magenta">{error}</p>}

        <button
          type="button"
          onClick={handleUpgrade}
          disabled={busy}
          className="w-full rounded-lg bg-neon-magenta px-3 py-2 text-sm font-semibold text-[#0b0e14] shadow-glow-magenta transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Redirigiendo a Stripe...' : 'Unlock VIP Access'}
        </button>
      </div>
    </div>
  );
}
