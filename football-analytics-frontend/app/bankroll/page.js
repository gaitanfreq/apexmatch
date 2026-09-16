'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import PerformanceStats from '@/components/PerformanceStats';
import BankrollChart from '@/components/BankrollChart';
import BankrollSettingsCard from '@/components/BankrollSettingsCard';
import RegisterBetModal from '@/components/RegisterBetModal';
import BetsHistoryTable from '@/components/BetsHistoryTable';
import ApiErrorState from '@/components/ApiErrorState';
import { PlusIcon } from '@/components/ui/icons';

/** Bankroll Tracker personal: bankroll inicial + stake configurables, ROI/curva calculados en vivo, registro de apuestas. */
export default function BankrollPage() {
  const { data: session, status } = useSession();
  const token = session?.backendToken;

  const [stats, setStats] = useState(null);
  const [bets, setBets] = useState(null);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const [statsRes, betsRes] = await Promise.all([api.getBankrollStats(token), api.getBankrollBets(token)]);
      setStats(statsRes);
      setBets(betsRes.bets);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleDeleteBet(id) {
    try {
      await api.deleteBet(token, id);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  if (status === 'loading' || (!stats && !error)) {
    return <p className="pt-8 text-sm text-ink-muted">Cargando tu bankroll...</p>;
  }

  const defaultStake = stats
    ? stats.settings.stakeUnitType === 'fixed'
      ? stats.settings.stakeUnitValue
      : Math.round(stats.currentBankroll * (stats.settings.stakeUnitValue / 100) * 100) / 100
    : undefined;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4 pt-4">
        <div>
          <span className="badge bg-neon-green/15 text-neon-green">Bankroll Tracker</span>
          <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Tu Bankroll</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            ROI, % de aciertos y la curva de crecimiento se recalculan automáticamente a partir de las
            apuestas que registres abajo, sobre tu bankroll inicial configurado.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-neon-green px-4 py-2 text-sm font-semibold text-[#0b0e14] shadow-glow-green transition-opacity hover:opacity-90"
        >
          <PlusIcon width={16} height={16} /> Registrar Apuesta
        </button>
      </section>

      {error && <ApiErrorState message={error} />}

      {stats && (
        <>
          <div className="space-y-4">
            <PerformanceStats
              stats={stats}
              recommendationsLabel="Apuestas Registradas"
              recommendationsHint="tu historial personal"
              bankrollHint={`base $${stats.settings.initialBankroll.toLocaleString()}`}
            />
            <BankrollChart data={stats.bankrollCurve} />
          </div>

          <BankrollSettingsCard settings={stats.settings} token={token} onSaved={refresh} />

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Historial de Apuestas
            </h2>
            <BetsHistoryTable bets={bets} onDelete={handleDeleteBet} />
          </div>
        </>
      )}

      <RegisterBetModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        token={token}
        defaultStake={defaultStake}
        onRegistered={() => {
          setModalOpen(false);
          refresh();
        }}
      />
    </div>
  );
}
