'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ApexMatchLogo from '@/components/ui/ApexMatchLogo';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api.register(email, password);
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) throw new Error('La cuenta se creó pero no se pudo iniciar sesión automáticamente.');
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 flex justify-center">
          <ApexMatchLogo variant="full" size="md" showTagline={false} />
        </div>

        <h1 className="mb-1 text-center text-lg font-semibold text-white">Crear Cuenta</h1>
        <p className="mb-6 text-center text-sm text-ink-muted">
          Empieza con el plan Gratuito — actualiza a VIP cuando quieras.
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
            minLength={8}
            placeholder="Contraseña (mínimo 8 caracteres)"
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
            {busy ? 'Creando cuenta...' : 'Crear Cuenta'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-ink-muted">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-electric-blue hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
