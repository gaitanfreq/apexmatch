'use client';

import { useI18n } from './i18n/LanguageProvider';

function MetricTile({ label, value, accent = 'text-white' }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`stat-value mt-1 ${accent}`}>{value}</p>
    </div>
  );
}

/** Métricas rápidas del panel de administración: total de usuarios, VIP activos, apuestas en el sistema. */
export default function AdminMetrics({ stats }) {
  const { t } = useI18n();
  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <MetricTile label={t('admin.totalUsers')} value={stats.totalUsers} accent="text-white" />
      <MetricTile label={t('admin.activeVip')} value={stats.activeVipUsers} accent="text-neon-green glow-text-green" />
      <MetricTile label={t('admin.totalBets')} value={stats.totalBets} accent="text-electric-blue" />
    </div>
  );
}
