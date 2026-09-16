'use client';

import { useState } from 'react';
import AdminMetrics from './AdminMetrics';
import AdminUsersTable from './AdminUsersTable';

/** Contenedor del panel de administración: mantiene las métricas sincronizadas con los cambios de la tabla. */
export default function AdminDashboard({ initialUsers, initialStats }) {
  const [stats, setStats] = useState(initialStats);

  return (
    <div className="space-y-6">
      <AdminMetrics stats={stats} />
      <AdminUsersTable initialUsers={initialUsers} onStatsChange={setStats} />
    </div>
  );
}
