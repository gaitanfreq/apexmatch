'use client';

import { useState } from 'react';
import Image from 'next/image';
import Sidebar from './Sidebar';
import ApexMatchLogo from './ui/ApexMatchLogo';
import { MenuIcon } from './ui/icons';
import { useI18n } from './i18n/LanguageProvider';

/** Shell de la app: sidebar fija en desktop, drawer deslizante en mobile. */
export default function AppShell({ children }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  return (
    <div className="min-h-screen">
      <Sidebar open={open} onClose={() => setOpen(false)} />

      <div className="md:pl-64">
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#232b3e] bg-[#090a0f]/90 px-4 py-3 backdrop-blur md:hidden">
          <ApexMatchLogo variant="full" size="md" showTagline={false} />
          <button
            onClick={() => setOpen(true)}
            aria-label={t('nav.openMenu')}
            className="rounded-md p-1.5 text-ink-muted hover:bg-white/5"
          >
            <MenuIcon />
          </button>
        </div>

        <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">{children}</main>

        <footer className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <Image
            src="/images/brand/logo-horizontal-mono.png"
            alt="ApexMatch"
            width={1600}
            height={400}
            className="mb-4 h-6 w-auto rounded opacity-70"
          />
          <p className="text-xs text-slate-500">{t('footer.disclaimer')}</p>
        </footer>
      </div>
    </div>
  );
}
