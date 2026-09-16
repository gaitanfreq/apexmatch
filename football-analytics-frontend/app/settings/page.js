'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import RoleBadge, { effectiveRole } from '@/components/RoleBadge';
import { api } from '@/lib/api';
import { useI18n } from '@/components/i18n/LanguageProvider';
import LanguageToggle from '@/components/i18n/LanguageToggle';

/** Settings: estado de la cuenta autenticada (protegida por middleware.js) y gestión de plan/sesión. */
export default function SettingsPage() {
  const { data: session } = useSession();
  const { t } = useI18n();
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
        <span className="badge bg-electric-blue/15 text-electric-blue">{t('settings.badge')}</span>
        <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{t('settings.title')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t('settings.subtitle')}</p>
      </section>

      <div className="card max-w-md p-6">
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-muted">{t('settings.email')}</p>
            <p className="text-sm text-white">{session.user.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-muted">{t('settings.rolePlan')}</p>
            <RoleBadge role={role} className="mt-1" />
            {role === 'ADMIN' && (
              <p className="mt-1 text-xs text-ink-muted">{t('settings.adminNote')}</p>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-xs uppercase tracking-wide text-ink-muted">{t('settings.language')}</p>
            <LanguageToggle />
          </div>

          {error && <p className="text-xs text-neon-magenta">{error}</p>}

          {!hasFullAccess && (
            <button
              onClick={handleUpgrade}
              disabled={busy}
              className="w-full rounded-lg bg-neon-magenta px-3 py-2 text-sm font-semibold text-[#0b0e14] shadow-glow-magenta hover:opacity-90 disabled:opacity-50"
            >
              {busy ? t('settings.redirectingStripe') : t('settings.unlockVip')}
            </button>
          )}

          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full rounded-lg border border-[#232b3e] bg-black/20 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5"
          >
            {t('settings.logout')}
          </button>
        </div>
      </div>
    </div>
  );
}
