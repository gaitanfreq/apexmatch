import { API_URL } from '@/lib/api';

/** Estado de error reutilizable cuando el backend de analítica no responde. */
export default function ApiErrorState({ message }) {
  return (
    <div className="card border-neon-magenta/30 p-6 text-center text-sm text-ink-muted">
      <p className="mb-1 font-medium text-neon-magenta">No se pudo conectar con la API</p>
      <p>{message || `Verifica que el backend esté corriendo en ${API_URL}.`}</p>
    </div>
  );
}
