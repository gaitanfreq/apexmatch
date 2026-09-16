import Link from 'next/link';
import { api } from '@/lib/api';
import PerformanceStats from '@/components/PerformanceStats';
import BankrollChart from '@/components/BankrollChart';
import LowRiskHeroCard from '@/components/LowRiskHeroCard';
import PackageCard from '@/components/PackageCard';
import FixturesTable from '@/components/FixturesTable';
import ApiErrorState from '@/components/ApiErrorState';
import T from '@/components/i18n/T';

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
        <span className="badge bg-neon-green/15 text-neon-green"><T k="home.planFree" /></span>
        <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
          <T k="home.title" />
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          <T k="home.subtitle" />
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
            <T k="home.lowRiskPackage" />
          </h2>
          <span className="text-xs text-ink-muted"><T k="home.cumulativeProbHint" /></span>
        </div>

        {packagesResult.error ? (
          <ApiErrorState message={packagesResult.error} />
        ) : packagesResult.data.bestPackage ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <LowRiskHeroCard pkg={packagesResult.data.bestPackage} />
            {packagesResult.data.alternatives?.slice(0, 1).map((pkg, i) => (
              <PackageCard key={i} pkg={pkg} title={<T k="home.alternativePackage" />} />
            ))}
          </div>
        ) : (
          <div className="card p-6 text-center text-sm text-ink-muted">
            <T k="home.noPackages" />
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            <T k="home.livePredictions" />
          </h2>
          <Link href="/predictions" className="text-xs text-electric-blue hover:underline">
            <T k="home.viewAll" />
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
          <span className="badge bg-neon-magenta/15 text-neon-magenta glow-text-magenta"><T k="home.vipBadge" /></span>
          <h2 className="text-lg font-semibold text-white"><T k="home.vipTeaserTitle" /></h2>
          <p className="max-w-md text-sm text-ink-muted">
            <T k="home.vipTeaserDesc" />
          </p>
          <Link
            href="/vip"
            className="rounded-lg bg-neon-magenta px-4 py-2 text-sm font-semibold text-[#0b0e14] shadow-glow-magenta transition-opacity hover:opacity-90"
          >
            <T k="home.unlockVip" />
          </Link>
        </div>
      </section>
    </div>
  );
}
