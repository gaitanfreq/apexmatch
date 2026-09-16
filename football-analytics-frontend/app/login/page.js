'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ApexMatchLogo from '@/components/ui/ApexMatchLogo';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const result = await signIn('credentials', { email, password, redirect: false });

    if (result?.error) {
      setError('Email o contraseña incorrectos.');
      setBusy(false);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 flex justify-center">
          <ApexMatchLogo variant="full" size="md" showTagline={false} />
        </div>

        <h1 className="mb-1 text-center text-lg font-semibold text-white">Iniciar Sesión</h1>
        <p className="mb-6 text-center text-sm text-ink-muted">
          Accede a tu cuenta de ApexMatch.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-[#232b3e] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-neon-green focus:outline-none"
          />
          <input
            type="password"
            required
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-[#232b3e] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-neon-green focus:outline-none"
          />

          {error && <p className="text-xs text-neon-magenta">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-neon-green px-3 py-2 text-sm font-semibold text-[#0b0e14] shadow-glow-green transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-ink-muted">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="text-electric-blue hover:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
