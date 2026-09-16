const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Cliente fetch mínimo hacia el backend de analítica. Adjunta como Bearer
 * token el JWT propio del backend (`session.backendToken`, emitido por
 * NextAuth vía el proveedor Credentials — ver lib/authOptions.js) para que
 * las rutas VIP/admin puedan identificar el rol y el plan del usuario.
 */
async function apiFetch(path, { token, ...options } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers, cache: 'no-store' });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const error = new Error(data?.message || `Request to ${path} failed with ${res.status}`);
    error.status = res.status;
    error.body = data;
    throw error;
  }

  return data;
}

export const api = {
  getPredictionsToday: ({ token, withinHours } = {}) =>
    apiFetch(`/api/predictions/today${withinHours ? `?withinHours=${withinHours}` : ''}`, { token }),
  getLeagues: () => apiFetch('/api/leagues'),
  getLivePredictions: ({ token, withinHours, leagueIds, statuses } = {}) => {
    const params = new URLSearchParams();
    if (withinHours) params.set('withinHours', withinHours);
    if (leagueIds?.length) params.set('leagueIds', leagueIds.join(','));
    if (statuses?.length) params.set('statuses', statuses.join(','));
    const qs = params.toString();
    return apiFetch(`/api/predictions/live${qs ? `?${qs}` : ''}`, { token });
  },
  getLowRiskPackages: () => apiFetch('/api/packages/low-risk'),
  getValueBets: (token) => apiFetch('/api/value-bets', { token }),
  getPerformanceStats: () => apiFetch('/api/stats/performance'),
  register: (email, password) =>
    apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  createCheckoutSession: (email) =>
    apiFetch('/api/subscriptions/checkout', { method: 'POST', body: JSON.stringify({ email }) }),
  getMySubscription: (token) => apiFetch('/api/subscriptions/me', { token }),
  getAdminUsers: (token) => apiFetch('/api/admin/users', { token }),
  updateUserTier: (token, userId, tier) =>
    apiFetch(`/api/admin/users/${userId}`, { token, method: 'PATCH', body: JSON.stringify({ tier }) }),
  getBankrollSettings: (token) => apiFetch('/api/bankroll/settings', { token }),
  updateBankrollSettings: (token, settings) =>
    apiFetch('/api/bankroll/settings', { token, method: 'PUT', body: JSON.stringify(settings) }),
  getBankrollStats: (token) => apiFetch('/api/bankroll/stats', { token }),
  getBankrollBets: (token) => apiFetch('/api/bankroll/bets', { token }),
  registerBet: (token, bet) => apiFetch('/api/bankroll/bets', { token, method: 'POST', body: JSON.stringify(bet) }),
  deleteBet: (token, id) => apiFetch(`/api/bankroll/bets/${id}`, { token, method: 'DELETE' }),
};

export { API_URL };
