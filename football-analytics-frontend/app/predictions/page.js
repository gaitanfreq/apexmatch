'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import MatchCard from '@/components/MatchCard';
import LeagueFilter from '@/components/LeagueFilter';
import StatusFilter, { STATUS_FILTER_OPTIONS } from '@/components/StatusFilter';
import ApiErrorState from '@/components/ApiErrorState';
import MethodologyNote from '@/components/MethodologyNote';
import { useI18n } from '@/components/i18n/LanguageProvider';

/** Live Predictions: partidos programados/en vivo/finalizados, filtrables por liga y estado. */
export default function PredictionsPage() {
  const { data: session } = useSession();
  const { t } = useI18n();
  const token = session?.backendToken;

  const [leagues, setLeagues] = useState([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState(null);
  const [statusKey, setStatusKey] = useState('upcoming');
  const [predictions, setPredictions] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getLeagues().then((res) => setLeagues(res.leagues)).catch(() => {});
  }, []);

  // `ignore` evita que una respuesta vieja (ej. de "Finalizados") sobreescriba el
  // estado con datos obsoletos si el usuario cambia de filtro antes de que resuelva
  // — sin esto, dos fetches en vuelo pueden resolver fuera de orden y "pisar" el
  // resultado del filtro más reciente con el de uno anterior.
  useEffect(() => {
    let ignore = false;
    const statuses = STATUS_FILTER_OPTIONS.find((o) => o.key === statusKey)?.statuses;

    api
      .getLivePredictions({
        token,
        withinHours: 168,
        leagueIds: selectedLeagueId ? [selectedLeagueId] : [],
        statuses,
      })
      .then((res) => {
        if (ignore) return;
        setPredictions(res.fixtures);
        setError(null);
      })
      .catch((err) => {
        if (ignore) return;
        setError(err.message);
      });

    return () => {
      ignore = true;
    };
  }, [token, selectedLeagueId, statusKey]);

  return (
    <div className="space-y-6">
      <section className="pt-4">
        <span className="badge bg-electric-blue/15 text-electric-blue">{t('predictions.badge')}</span>
        <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{t('predictions.title')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t('predictions.subtitle')}</p>
      </section>

      <MethodologyNote />

      <section className="space-y-3">
        <LeagueFilter leagues={leagues} selectedLeagueId={selectedLeagueId} onSelect={setSelectedLeagueId} />
        <StatusFilter selectedKey={statusKey} onSelect={setStatusKey} />
      </section>

      {error && <ApiErrorState message={error} />}

      {!error && predictions && predictions.length === 0 && (
        <div className="card p-6 text-center text-sm text-ink-muted">{t('predictions.noMatches')}</div>
      )}

      {!error && predictions && predictions.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {predictions.map((p) => (
            <MatchCard key={p.fixture.id} prediction={p} />
          ))}
        </div>
      )}
    </div>
  );
}
