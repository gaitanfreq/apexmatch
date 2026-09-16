'use client';

import clsx from 'clsx';
import { TrashIcon } from './ui/icons';
import { useI18n } from './i18n/LanguageProvider';
import { formatKickoff } from '@/lib/formatDate';

const RESULT_KEYS = {
  won: { key: 'registerBet.won', className: 'bg-neon-green/15 text-neon-green' },
  lost: { key: 'registerBet.lost', className: 'bg-neon-magenta/15 text-neon-magenta' },
  void: { key: 'registerBet.void', className: 'bg-electric-blue/15 text-electric-blue' },
};

/** Historial de apuestas registradas manualmente por el usuario, con opción de borrar. */
export default function BetsHistoryTable({ bets, onDelete }) {
  const { t, locale } = useI18n();

  if (!bets || bets.length === 0) {
    return <div className="card p-6 text-center text-sm text-ink-muted">{t('betsHistory.empty')}</div>;
  }

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[680px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#232b3e] text-left text-[11px] uppercase tracking-wide text-ink-muted">
            <th className="px-4 py-3 font-medium">{t('betsHistory.match')}</th>
            <th className="px-4 py-3 font-medium">{t('betsHistory.odds')}</th>
            <th className="px-4 py-3 font-medium">{t('betsHistory.stake')}</th>
            <th className="px-4 py-3 font-medium">{t('betsHistory.result')}</th>
            <th className="px-4 py-3 font-medium">{t('betsHistory.pl')}</th>
            <th className="px-4 py-3 font-medium">{t('betsHistory.date')}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {bets.map((bet) => {
            const resultInfo = RESULT_KEYS[bet.result] ?? RESULT_KEYS.void;
            return (
              <tr key={bet.id} className="border-b border-[#232b3e]/60 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{bet.matchLabel}</p>
                  {bet.market && <p className="text-xs text-ink-muted">{bet.market}</p>}
                </td>
                <td className="px-4 py-3 font-mono text-slate-300">{bet.oddsDecimal.toFixed(2)}</td>
                <td className="px-4 py-3 font-mono text-slate-300">${bet.stakeAmount.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={clsx('badge', resultInfo.className)}>{t(resultInfo.key)}</span>
                </td>
                <td className={clsx('px-4 py-3 font-mono', bet.profitLoss >= 0 ? 'text-neon-green' : 'text-neon-magenta')}>
                  {bet.profitLoss >= 0 ? '+' : ''}
                  ${bet.profitLoss.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-xs text-ink-muted">{formatKickoff(bet.placedAt, locale)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onDelete(bet.id)}
                    aria-label={t('betsHistory.delete')}
                    className="text-ink-muted hover:text-neon-magenta"
                  >
                    <TrashIcon width={16} height={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
