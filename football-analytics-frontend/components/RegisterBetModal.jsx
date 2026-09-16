'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { CloseIcon } from './ui/icons';

const RESULT_OPTIONS = [
  { value: 'won', label: 'Ganada', tone: 'text-neon-green border-neon-green bg-neon-green/15' },
  { value: 'lost', label: 'Perdida', tone: 'text-neon-magenta border-neon-magenta bg-neon-magenta/15' },
  { value: 'void', label: 'Anulada', tone: 'text-electric-blue border-electric-blue bg-electric-blue/15' },
];

/** Modal rápido para registrar una apuesta ya resuelta (Partido, Cuota, Stake, Resultado). */
export default function RegisterBetModal({ open, onClose, token, defaultStake, onRegistered }) {
  const [matchLabel, setMatchLabel] = useState('');
  const [market, setMarket] = useState('');
  const [oddsDecimal, setOddsDecimal] = useState('');
  const [stakeAmount, setStakeAmount] = useState('');
  const [result, setResult] = useState('won');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setMatchLabel('');
      setMarket('');
      setOddsDecimal('');
      setResult('won');
      setError(null);
      setStakeAmount(defaultStake ? String(defaultStake) : '');
    }
  }, [open, defaultStake]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.registerBet(token, {
        matchLabel,
        market: market || undefined,
        oddsDecimal: Number(oddsDecimal),
        stakeAmount: Number(stakeAmount),
        result,
      });
      onRegistered?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Registrar Apuesta / Resultado</h3>
          <button onClick={onClose} className="text-ink-muted hover:text-white">
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            required
            placeholder="Partido (ej. Real Madrid vs Barcelona)"
            value={matchLabel}
            onChange={(e) => setMatchLabel(e.target.value)}
            className="w-full rounded-lg border border-[#232b3e] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-neon-green focus:outline-none"
          />
          <input
            type="text"
            placeholder="Mercado (opcional, ej. Over 2.5)"
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            className="w-full rounded-lg border border-[#232b3e] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-neon-green focus:outline-none"
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              required
              min="1.01"
              step="0.01"
              placeholder="Cuota"
              value={oddsDecimal}
              onChange={(e) => setOddsDecimal(e.target.value)}
              className="w-full rounded-lg border border-[#232b3e] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-neon-green focus:outline-none"
            />
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              placeholder="Stake ($)"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              className="w-full rounded-lg border border-[#232b3e] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-neon-green focus:outline-none"
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs text-ink-muted">Resultado</p>
            <div className="grid grid-cols-3 gap-2">
              {RESULT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setResult(opt.value)}
                  className={clsx(
                    'rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                    result === opt.value ? opt.tone : 'border-[#232b3e] bg-black/20 text-ink-muted hover:text-white'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-neon-magenta">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-neon-green px-3 py-2 text-sm font-semibold text-[#0b0e14] shadow-glow-green transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Guardando...' : 'Registrar Apuesta'}
          </button>
        </form>
      </div>
    </div>
  );
}
