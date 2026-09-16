'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import Paywall from '@/components/Paywall';
import ValueBetCard from '@/components/ValueBetCard';
import ApiErrorState from '@/components/ApiErrorState';
import MethodologyNote from '@/components/MethodologyNote';
import { effectiveRole } from '@/components/RoleBadge';
import { useI18n } from '@/components/i18n/LanguageProvider';

function VipContent() {
  const { data: session } = useSession();
  const { t } = useI18n();
  const role = effectiveRole(session?.user);
  const hasFullAccess = role === 'ADMIN' || role === 'VIP';
  const [valueBets, setValueBets] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!hasFullAccess || !session?.backendToken) return;
    api
      .getValueBets(session.backendToken)
      .then((res) => setValueBets(res.valueBets))
      .catch((err) => setError(err.message));
  }, [hasFullAccess, session?.backendToken]);

  if (!hasFullAccess) return null;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">{t('vip.detectedTitle')}</h2>
        <span className="text-xs text-ink-muted">{t('vip.edgeHint')}</span>
      </div>

      {error && <ApiErrorState message={error} />}
      {!error && !valueBets && <p className="text-sm text-ink-muted">{t('vip.loadingOpportunities')}</p>}
      {!error && valueBets && valueBets.length === 0 && (
        <div className="card p-6 text-center text-sm text-ink-muted">{t('vip.noValueBets')}</div>
      )}
      {!error && valueBets && valueBets.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {valueBets.map((bet, i) => (
            <ValueBetCard key={i} bet={bet} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function VipPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-8">
      <section className="pt-4">
        <span className="badge bg-neon-magenta/15 text-neon-magenta glow-text-magenta">{t('vip.badge')}</span>
        <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{t('vip.title')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t('vip.subtitle')}</p>
      </section>

      <MethodologyNote />

      <Paywall>
        <VipContent />
      </Paywall>
    </div>
  );
}
