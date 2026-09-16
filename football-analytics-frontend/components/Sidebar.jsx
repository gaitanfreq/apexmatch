'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import clsx from 'clsx';
import ApexMatchLogo from './ui/ApexMatchLogo';
import RoleBadge, { effectiveRole } from './RoleBadge';
import { useI18n } from './i18n/LanguageProvider';
import LanguageToggle from './i18n/LanguageToggle';
import {
  DashboardIcon,
  SignalIcon,
  DiamondIcon,
  WalletIcon,
  SettingsIcon,
  LockIcon,
  CloseIcon,
  ShieldIcon,
  UserIcon,
  LogoutIcon,
} from './ui/icons';

function useNavItems(t) {
  return [
    { href: '/', label: t('nav.dashboard'), icon: DashboardIcon },
    { href: '/predictions', label: t('nav.livePredictions'), icon: SignalIcon },
    { href: '/vip', label: t('nav.valueBets'), icon: DiamondIcon, vip: true },
    { href: '/bankroll', label: t('nav.bankrollTracker'), icon: WalletIcon },
    { href: '/settings', label: t('nav.settings'), icon: SettingsIcon },
  ];
}

/** Sidebar compacta izquierda: logo arriba, navegación, estado de sesión abajo. Drawer en mobile. */
export default function Sidebar({ open, onClose }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { t } = useI18n();

  const role = effectiveRole(session?.user);
  const hasFullAccess = role === 'ADMIN' || role === 'VIP';

  const baseNavItems = useNavItems(t);
  const navItems = role === 'ADMIN'
    ? [...baseNavItems, { href: '/admin', label: t('nav.admin'), icon: ShieldIcon }]
    : baseNavItems;

  return (
    <>
      {open && (
        <button
          aria-label={t('nav.closeMenu')}
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#232b3e] bg-[#0b0e14] px-4 py-5 transition-transform duration-200 md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="mb-8 flex items-center justify-between">
          <ApexMatchLogo variant="full" size="sm" />
          <button onClick={onClose} className="rounded-md p-1 text-ink-muted hover:bg-white/5 md:hidden">
            <CloseIcon />
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={clsx(
                  'flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-[#141923] text-white shadow-[inset_0_0_0_1px_#232b3e]'
                    : 'text-ink-muted hover:bg-[#141923]/60 hover:text-white'
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className={active ? 'text-neon-green' : 'text-ink-muted'} />
                  {item.label}
                </span>
                {item.vip && (
                  <LockIcon
                    width={14}
                    height={14}
                    className={hasFullAccess ? 'text-neon-green' : 'text-neon-magenta'}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 space-y-3">
          <LanguageToggle className="w-full justify-center" />

          <div className="rounded-lg border border-[#232b3e] bg-[#141923]/60 p-3 text-xs">
            {status === 'loading' ? null : session ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#232b3e] text-xs font-bold uppercase text-white">
                    {session.user.email?.[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-slate-300">{session.user.email}</p>
                    <RoleBadge role={role} className="mt-1" />
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Link
                    href="/settings"
                    className="flex flex-1 items-center justify-center gap-1 rounded-md border border-[#232b3e] bg-black/20 py-1.5 text-[11px] font-medium text-slate-300 hover:bg-white/5"
                  >
                    <UserIcon width={13} height={13} /> {t('nav.account')}
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md border border-[#232b3e] bg-black/20 py-1.5 text-[11px] font-medium text-slate-300 hover:bg-white/5"
                  >
                    <LogoutIcon width={13} height={13} /> {t('nav.logout')}
                  </button>
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={onClose}
                className="block rounded-md bg-neon-green py-2 text-center text-[11px] font-semibold text-[#0b0e14] shadow-glow-green hover:opacity-90"
              >
                {t('nav.login')}
              </Link>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
