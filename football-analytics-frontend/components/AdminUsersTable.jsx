'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import RoleBadge, { effectiveRole } from './RoleBadge';
import { api } from '@/lib/api';
import { useI18n } from './i18n/LanguageProvider';
import { formatLongDate } from '@/lib/formatDate';

const TIER_OPTIONS = [
  { value: 'free', label: 'FREE' },
  { value: 'vip', label: 'VIP' },
  { value: 'admin', label: 'ADMIN' },
];

/** Tabla interactiva de usuarios: cambia el nivel de acceso (FREE/VIP/ADMIN) desde un select por fila. */
export default function AdminUsersTable({ initialUsers, onStatsChange }) {
  const { data: session } = useSession();
  const { t, locale } = useI18n();
  const token = session?.backendToken;
  const currentUserEmail = session?.user?.email;

  const [users, setUsers] = useState(initialUsers);
  const [savingId, setSavingId] = useState(null);
  const [errorById, setErrorById] = useState({});

  async function handleTierChange(user, tier) {
    setSavingId(user.id);
    setErrorById((prev) => ({ ...prev, [user.id]: null }));
    try {
      const result = await api.updateUserTier(token, user.id, tier);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? result.user : u)));
      onStatsChange?.(result.stats);
    } catch (err) {
      setErrorById((prev) => ({ ...prev, [user.id]: err.message }));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#232b3e] text-left text-[11px] uppercase tracking-wide text-ink-muted">
            <th className="px-4 py-3 font-medium">{t('admin.email')}</th>
            <th className="px-4 py-3 font-medium">{t('admin.rolePlan')}</th>
            <th className="px-4 py-3 font-medium">{t('admin.subStatus')}</th>
            <th className="px-4 py-3 font-medium">{t('admin.registered')}</th>
            <th className="px-4 py-3 font-medium">{t('admin.changeAccess')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const role = effectiveRole({ role: u.role, plan: u.plan });
            const isSelf = u.email === currentUserEmail;

            return (
              <tr key={u.id} className="border-b border-[#232b3e]/60 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-white">
                  {u.email}
                  {isSelf && <span className="ml-1.5 text-xs text-ink-muted">({t('admin.you')})</span>}
                </td>
                <td className="px-4 py-3">
                  <RoleBadge role={role} />
                </td>
                <td className="px-4 py-3 text-ink-muted">{u.subscriptionStatus}</td>
                <td className="px-4 py-3 text-ink-muted">{formatLongDate(u.createdAt, locale)}</td>
                <td className="px-4 py-3">
                  {isSelf ? (
                    <span className="text-xs text-ink-muted">{t('admin.notEditable')}</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        value={role.toLowerCase()}
                        disabled={savingId === u.id}
                        onChange={(e) => handleTierChange(u, e.target.value)}
                        className="rounded-lg border border-[#232b3e] bg-black/30 px-2.5 py-1.5 text-xs text-white focus:border-neon-green focus:outline-none disabled:opacity-50"
                      >
                        {TIER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {savingId === u.id && <span className="text-xs text-ink-muted">{t('admin.saving')}</span>}
                    </div>
                  )}
                  {errorById[u.id] && <p className="mt-1 text-xs text-neon-magenta">{errorById[u.id]}</p>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
