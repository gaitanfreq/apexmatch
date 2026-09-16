'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

/** Configuración personal del Bankroll Tracker: bankroll inicial + unidad de stake (monto fijo o %). */
export default function BankrollSettingsCard({ settings, token, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [initialBankroll, setInitialBankroll] = useState(settings.initialBankroll);
  const [stakeUnitType, setStakeUnitType] = useState(settings.stakeUnitType);
  const [stakeUnitValue, setStakeUnitValue] = useState(settings.stakeUnitValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.updateBankrollSettings(token, {
        initialBankroll: Number(initialBankroll),
        stakeUnitType,
        stakeUnitValue: Number(stakeUnitValue),
      });
      setEditing(false);
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex flex-wrap gap-8 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-muted">Bankroll Inicial</p>
            <p className="font-mono text-lg text-white">${Number(settings.initialBankroll).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-muted">Unidad de Stake</p>
            <p className="font-mono text-lg text-white">
              {settings.stakeUnitType === 'fixed' ? `$${settings.stakeUnitValue}` : `${settings.stakeUnitValue}%`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg border border-[#232b3e] bg-black/20 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5"
        >
          Configurar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="card space-y-3 p-5">
      <h3 className="text-sm font-semibold text-white">Configurar Bankroll</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs text-ink-muted">
          Bankroll Inicial ($)
          <input
            type="number"
            min="1"
            step="0.01"
            required
            value={initialBankroll}
            onChange={(e) => setInitialBankroll(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#232b3e] bg-black/30 px-3 py-2 text-sm text-white focus:border-neon-green focus:outline-none"
          />
        </label>
        <label className="block text-xs text-ink-muted">
          Tipo de Unidad
          <select
            value={stakeUnitType}
            onChange={(e) => setStakeUnitType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#232b3e] bg-black/30 px-3 py-2 text-sm text-white focus:border-neon-green focus:outline-none"
          >
            <option value="fixed">Monto fijo ($)</option>
            <option value="percentage">% del bankroll</option>
          </select>
        </label>
        <label className="block text-xs text-ink-muted">
          Valor de la Unidad
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            value={stakeUnitValue}
            onChange={(e) => setStakeUnitValue(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#232b3e] bg-black/30 px-3 py-2 text-sm text-white focus:border-neon-green focus:outline-none"
          />
        </label>
      </div>

      {error && <p className="text-xs text-neon-magenta">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-neon-green px-4 py-2 text-sm font-semibold text-[#0b0e14] shadow-glow-green hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-lg border border-[#232b3e] bg-black/20 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
