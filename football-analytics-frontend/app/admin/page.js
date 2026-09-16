import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/authOptions';
import { api } from '@/lib/api';
import AdminDashboard from '@/components/AdminDashboard';
import ApiErrorState from '@/components/ApiErrorState';

/**
 * Panel de Administración — exclusivo para role='admin'.
 * Defensa en profundidad: middleware.js ya bloquea /admin a no-admins a
 * nivel de borde, y aquí se vuelve a verificar server-side antes de
 * consultar el backend, por si el middleware llegara a desactivarse.
 */
export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    redirect('/');
  }

  let users = null;
  let stats = null;
  let error = null;
  try {
    const res = await api.getAdminUsers(session.backendToken);
    users = res.users;
    stats = res.stats;
  } catch (err) {
    error = err.message;
  }

  return (
    <div className="space-y-6">
      <section className="pt-4">
        <span className="badge bg-neon-magenta/15 text-neon-magenta glow-text-magenta">★ Admin</span>
        <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Panel de Administración</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Cuentas registradas en ApexMatch, su rol y su plan de suscripción actual. Cambia el nivel de
          acceso de cualquier usuario directamente desde la tabla.
        </p>
      </section>

      {error ? <ApiErrorState message={error} /> : <AdminDashboard initialUsers={users} initialStats={stats} />}
    </div>
  );
}
