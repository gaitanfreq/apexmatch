# Football Analytics Frontend

Dashboard en Next.js (App Router) + Tailwind CSS + Recharts para la plataforma de
analítica predictiva de fútbol. Consume la API REST de
[`football-analytics-backend`](../football-analytics-backend).

## Setup

```bash
cp .env.local.example .env.local   # apunta a la URL del backend
npm install
npm run dev
```

Requiere que `football-analytics-backend` esté corriendo (`npm run api`, puerto 4000
por defecto) para que las páginas puedan cargar datos reales; sin el backend arriba,
las secciones muestran un estado de error controlado en vez de romper la página.

## Estructura

```
app/
  layout.js        Layout raíz (dark mode fijo, navbar, footer con disclaimer)
  page.js           Dashboard público: stats históricas + paquetes de bajo riesgo
  vip/page.js        Dashboard VIP: value bets, detrás del Paywall
components/
  Navbar.jsx          Navegación + badge de plan del usuario
  BankrollChart.jsx    Curva de bankroll (Recharts AreaChart)
  PerformanceStats.jsx  Tiles de ROI% / win rate% / bankroll actual
  PackageCard.jsx        Tarjeta de paquete combinado (riesgo, cuotas, prob., justificación)
  ValueBetCard.jsx        Tarjeta de value bet (edge, cuota justa vs. cuota real) — VIP
  RiskBadge.jsx             Badge de nivel de riesgo reutilizable
  Paywall.jsx                Muro VIP: login o Stripe Checkout
  ApiErrorState.jsx           Estado de error reutilizable cuando el backend no responde
lib/
  api.js    Cliente fetch hacia el backend (adjunta el JWT como Bearer si existe)
  session.js  Persistencia de sesión en localStorage
  useSession.js Hook de sesión para componentes cliente
```

## Arquitectura Freemium

- **Sección Gratuita** (`app/page.js`, server component): estadísticas históricas
  públicas (`GET /api/stats/performance`) y paquetes de bajo riesgo
  (`GET /api/packages/low-risk`) — ambos endpoints son públicos, sin autenticación.
- **Muro VIP** (`app/vip/page.js` + `components/Paywall.jsx`): value bets
  (`GET /api/value-bets`) requiere un JWT Bearer con `plan: 'vip'`. El componente
  `Paywall` blurea el contenido y ofrece "Ya soy VIP" (login por email,
  `POST /api/auth/session`) o "Suscribirme VIP" (Stripe Checkout,
  `POST /api/subscriptions/checkout`, redirige a `checkoutUrl`).
- Tras pagar en Stripe, el webhook del backend activa la suscripción; el usuario
  vuelve a "Ya soy VIP" con su email y el JWT emitido ya refleja `plan: 'vip'`.

**Nota de alcance**: el login por email no verifica identidad (no hay magic link ni
password) — ver el comentario en `src/services/authService.js` del backend. Es un
scaffold suficiente para demostrar el gateo freemium; un producto real necesita un
proveedor de auth (NextAuth, Clerk, Auth0) o verificación de email.

## Diseño

Dark mode fijo (no hay toggle, es la identidad visual del producto), paleta
`surface` (grises azulados) + acentos `emerald`/`violet`/`amber`/`rose` definidos en
`tailwind.config.js`. Verificado en desktop (1280px) y mobile (375px).
