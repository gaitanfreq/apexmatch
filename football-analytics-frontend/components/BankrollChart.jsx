'use client';

import { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useI18n } from './i18n/LanguageProvider';
import { formatShortDate } from '@/lib/formatDate';

function CustomTooltip({ active, payload, label, locale }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#232b3e] bg-[#141923] px-3 py-2 text-xs shadow-glow-green">
      <p className="text-ink-muted">{formatShortDate(label, locale) || '—'}</p>
      <p className="font-mono text-sm font-semibold text-neon-green">${payload[0].value.toFixed(2)}</p>
    </div>
  );
}

/** Curva de crecimiento de bankroll — gráfico interactivo público (prueba de tracción del algoritmo). */
export default function BankrollChart({ data = [] }) {
  const { t, locale } = useI18n();
  const [range, setRange] = useState('all');

  const RANGES = [
    { key: '30d', label: '30D' },
    { key: 'all', label: t('bankrollChart.rangeAll') },
  ];

  const chartData = useMemo(() => {
    const points = data.map((point, index) => ({ index, date: point.date, bankroll: point.bankroll }));
    if (range === '30d') return points.slice(-11); // punto inicial aprox. + últimas ~10 liquidaciones
    return points;
  }, [data, range]);

  return (
    <div className="card p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{t('bankrollChart.title')}</h3>
        <div className="flex items-center gap-2">
          <span className="badge bg-neon-green/15 text-neon-green">{t('bankrollChart.verifiedHistory')}</span>
          <div className="flex rounded-lg border border-[#232b3e] bg-black/20 p-0.5 text-xs">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={
                  range === r.key
                    ? 'rounded-md bg-[#232b3e] px-2.5 py-1 font-medium text-white'
                    : 'rounded-md px-2.5 py-1 text-ink-muted hover:text-white'
                }
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {chartData.length <= 1 ? (
        <p className="py-16 text-center text-sm text-ink-muted">{t('bankrollChart.noHistory')}</p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="bankrollGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00FF87" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#00FF87" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#232b3e" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => formatShortDate(v, locale)}
                stroke="#475569"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#475569"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip content={<CustomTooltip locale={locale} />} />
              <Area
                type="monotone"
                dataKey="bankroll"
                stroke="#00FF87"
                strokeWidth={2}
                fill="url(#bankrollGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
