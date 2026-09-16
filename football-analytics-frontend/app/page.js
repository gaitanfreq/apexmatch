import Link from 'next/link';
import { api } from '@/lib/api';
import PerformanceStats from '@/components/PerformanceStats';
import BankrollChart from '@/components/BankrollChart';
import LowRiskHeroCard from '@/components/LowRiskHeroCard';
import PackageCard from '@/components/PackageCard';
import FixturesTable from '@/components/FixturesTable';
import ApiErrorState from '@/components/ApiErrorState';

export const dynamic = 'force-dynamic';

async function safeFetch(fn) {
  try {
    return { data: await fn(), error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/** Dashboard público (Sección Gratuita del freemium): KPIs, bankroll, pick del día y fixtures próximos. */
export default async function HomePage() {
  const [statsResult, packagesResult, predictionsResult] = await Promise.all([
    safeFetch(() => api.getPerformanceStats()),
    safeFetch(() => api.getLowRiskPackages()),
    safeFetch(() => api.getPredictionsToday()),
  ]);

  return (
    <div className="space-y-8">
      <section className="pt-4">
        <span className="badge bg-neon-green/15 text-neon-green">Plan Gratuito</span>
        <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
          ApexMatch Predictive Analytics
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Modelo de Poisson Bivariada + xG reciente, gestión de bankroll con Criterio de Kelly y detección de
          value bets. Aquí abajo: nuestro historial público de rendimiento y el pick de bajo riesgo del día.
        </p>
      </section>

      <section>
        {statsResult.error ? (
          <ApiErrorState message={statsResult.error} />
        ) : (
          <div className="space-y-4">
            <PerformanceStats stats={statsResult.data} />
            <BankrollChart data={statsResult.data.bankrollCurve} />
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Paquete de Bajo Riesgo
          </h2>
          <span className="text-xs text-ink-muted">Probabilidad acumulada proyectada &gt; 85%</span>
        </div>

        {packagesResult.error ? (
          <ApiErrorState message={packagesResult.error} />
        ) : packagesResult.data.bestPackage ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <LowRiskHeroCard pkg={packagesResult.data.bestPackage} />
            {packagesResult.data.alternatives?.slice(0, 1).map((pkg, i) => (
              <PackageCard key={i} pkg={pkg} title="Paquete Alternativo" />
            ))}
          </div>
        ) : (
          <div className="card p-6 text-center text-sm text-ink-muted">
            No hay fixtures próximos con suficiente probabilidad acumulada en este momento.
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Live Predictions
          </h2>
          <Link href="/predictions" className="text-xs text-electric-blue hover:underline">
            Ver todos →
          </Link>
        </div>

        {predictionsResult.error ? (
          <ApiErrorState message={predictionsResult.error} />
        ) : (
          <FixturesTable predictions={predictionsResult.data.predictions} limit={4} />
        )}
      </section>

      <section className="card relative overflow-hidden border-neon-magenta/30 p-8 text-center shadow-glow-magenta">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-neon-magenta/10 blur-3xl" />
        <div className="relative flex flex-col items-center gap-3">
          <span className="badge bg-neon-magenta/15 text-neon-magenta glow-text-magenta">Plan VIP</span>
          <h2 className="text-lg font-semibold text-white">¿Quieres las oportunidades de mayor edge?</h2>
          <p className="max-w-md text-sm text-ink-muted">
            El plan VIP desbloquea Value Bets (cuotas con margen &gt; 5% sobre el bookmaker) y los marcadores
            exactos más probables de cada partido.
          </p>
          <Link
            href="/vip"
            className="rounded-lg bg-neon-magenta px-4 py-2 text-sm font-semibold text-[#0b0e14] shadow-glow-magenta transition-opacity hover:opacity-90"
          >
            Unlock VIP Access
          </Link>
        </div>
      </section>
    </div>
  );
}
