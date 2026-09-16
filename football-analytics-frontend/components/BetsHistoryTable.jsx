import clsx from 'clsx';
import { TrashIcon } from './ui/icons';

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const RESULT_LABELS = {
  won: { label: 'Ganada', className: 'bg-neon-green/15 text-neon-green' },
  lost: { label: 'Perdida', className: 'bg-neon-magenta/15 text-neon-magenta' },
  void: { label: 'Anulada', className: 'bg-electric-blue/15 text-electric-blue' },
};

/** Historial de apuestas registradas manualmente por el usuario, con opción de borrar. */
export default function BetsHistoryTable({ bets, onDelete }) {
  if (!bets || bets.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-ink-muted">
        Aún no registraste apuestas. Usa &quot;Registrar Apuesta&quot; para empezar tu historial.
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[680px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#232b3e] text-left text-[11px] uppercase tracking-wide text-ink-muted">
            <th className="px-4 py-3 font-medium">Partido</th>
            <th className="px-4 py-3 font-medium">Cuota</th>
            <th className="px-4 py-3 font-medium">Stake</th>
            <th className="px-4 py-3 font-medium">Resultado</th>
            <th className="px-4 py-3 font-medium">P/L</th>
            <th className="px-4 py-3 font-medium">Fecha</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {bets.map((bet) => {
            const resultInfo = RESULT_LABELS[bet.result] ?? RESULT_LABELS.void;
            return (
              <tr key={bet.id} className="border-b border-[#232b3e]/60 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{bet.matchLabel}</p>
                  {bet.market && <p className="text-xs text-ink-muted">{bet.market}</p>}
                </td>
                <td className="px-4 py-3 font-mono text-slate-300">{bet.oddsDecimal.toFixed(2)}</td>
                <td className="px-4 py-3 font-mono text-slate-300">${bet.stakeAmount.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={clsx('badge', resultInfo.className)}>{resultInfo.label}</span>
                </td>
                <td className={clsx('px-4 py-3 font-mono', bet.profitLoss >= 0 ? 'text-neon-green' : 'text-neon-magenta')}>
                  {bet.profitLoss >= 0 ? '+' : ''}
                  ${bet.profitLoss.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-xs text-ink-muted">{formatDate(bet.placedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onDelete(bet.id)}
                    aria-label="Eliminar apuesta"
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
