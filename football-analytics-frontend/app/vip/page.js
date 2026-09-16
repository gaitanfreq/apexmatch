'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import Paywall from '@/components/Paywall';
import ValueBetCard from '@/components/ValueBetCard';
import ApiErrorState from '@/components/ApiErrorState';
import { effectiveRole } from '@/components/RoleBadge';

function VipContent() {
  const { data: session } = useSession();
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Value Bets Detectadas
        </h2>
        <span className="text-xs text-ink-muted">Edge &gt; 5% sobre la cuota del bookmaker</span>
      </div>

      {error && <ApiErrorState message={error} />}
      {!error && !valueBets && <p className="text-sm text-ink-muted">Cargando oportunidades...</p>}
      {!error && valueBets && valueBets.length === 0 && (
        <div className="card p-6 text-center text-sm text-ink-muted">
          No hay value bets por encima del umbral en este momento. El modelo solo recomienda cuando hay
          margen real.
        </div>
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
  return (
    <div className="space-y-8">
      <section className="pt-4">
        <span className="badge bg-neon-magenta/15 text-neon-magenta glow-text-magenta">Plan VIP</span>
        <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
          Value Betting y marcadores exactos
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Acceso en tiempo real a las cuotas con mayor edge detectadas por el motor de Poisson Bivariada,
          junto con el stake exacto recomendado por el Criterio de Kelly fraccionado.
        </p>
      </section>

      <Paywall>
        <VipContent />
      </Paywall>
    </div>
  );
}
