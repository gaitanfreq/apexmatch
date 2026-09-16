# Football Analytics Backend

Backend de ingesta y almacenamiento para una plataforma de analítica predictiva de
apuestas de fútbol. Consume [API-Football](https://www.api-football.com/) (estadísticas,
fixtures, cuotas, lesiones, alineaciones) y OpenWeatherMap (clima), y los normaliza en
PostgreSQL para que capas posteriores (feature engineering / modelos) consuman datos
limpios y versionados en el tiempo.

## Estructura

```
migrations/            Esquema SQL, numerado y aplicado secuencialmente
scripts/migrate.js      Runner de migraciones (sin dependencias externas)
src/config/             Carga y valida variables de entorno
src/db/pool.js          Pool de conexión pg + helper de transacciones
src/services/           Clientes HTTP externos (API-Football, clima) con rate limit y retry
src/repositories/       Acceso a datos (upserts idempotentes por entidad)
src/ingestion/          Lógica de negocio de sincronización (catálogo, fixtures, odds, injuries, lineups)
src/cron/               Programación de los jobs en tiempo real
src/index.js            Entrypoint del servicio de ingesta (arranca los cron jobs)
src/analytics/          Motor de probabilidades y gestión de riesgo (Fase 2)
src/api/                API REST (Fase 3): app Express, rutas, middlewares, orquestación
```

## Setup

1. Levantar PostgreSQL local (o usar una instancia gestionada):
   ```bash
   docker compose up -d
   ```
2. Copiar variables de entorno y completar tus API keys:
   ```bash
   cp .env.example .env
   ```
3. Instalar dependencias:
   ```bash
   npm install
   ```
4. Aplicar migraciones:
   ```bash
   npm run migrate
   ```
5. Backfill inicial (ligas, equipos, fixtures históricos, lesiones):
   ```bash
   npm run backfill
   ```
6. Arrancar el servicio de ingesta en tiempo real (cron jobs):
   ```bash
   npm start
   ```

## Jobs programados (`src/cron/index.js`)

| Job                  | Frecuencia   | Qué hace                                                        |
|----------------------|--------------|------------------------------------------------------------------|
| odds-poller          | cada 5 min   | Nuevas cuotas para partidos en las próximas 72h (append-only)   |
| closing-line-marker  | cada 1 min   | Marca la última cuota antes del kickoff como "closing line"     |
| lineups-poller       | cada 2 min   | Alineaciones confirmadas para partidos que arrancan en <90 min  |
| fixtures-refresh     | cada 1 hora  | Resultados, nuevos partidos programados, cambios de horario     |
| injuries-refresh     | cada 6 horas | Lesiones/sanciones reportadas                                    |

Cada job está protegido contra solapamiento (no corre si la ejecución anterior sigue
activa) y contra fallos catastróficos (se loguea, no tira el proceso).

## Manejo de errores e integraciones fallidas

- Toda corrida de ingesta se registra en `ingestion_runs` (status: running/success/partial/failed).
- Fallos por entidad individual (ej. un fixture puntual) se registran en `ingestion_errors`
  sin abortar el resto del batch — ver `src/ingestion/runJob.js`.
- Llamadas HTTP externas usan reintentos con backoff exponencial (`src/utils/retry.js`) y
  no reintentan errores no recuperables (401/403/404/422).
- El cliente de clima (`weatherClient.js`) es best-effort: si falla, el partido se sincroniza
  igual sin bloquear por un factor secundario.

## Notas de diseño del esquema

- `odds_snapshots` es **append-only**: cada sincronización inserta nuevas filas en vez de
  sobrescribir, permitiendo reconstruir la evolución completa de la cuota por partido/mercado/casa.
- `match_team_stats` guarda métricas avanzadas (xG, posesión, ataques peligrosos) por
  equipo y partido — clave para features de un modelo predictivo.
- `player_match_availability` es un snapshot calculado (lesión/sanción/disponible) por
  jugador y partido, pensado para consumirse directamente como feature sin tener que
  cruzar `player_injuries` + `player_suspensions` en tiempo de inferencia.
- `sync_watermarks` / `ingestion_runs` dan trazabilidad de qué se sincronizó y cuándo,
  para poder auditar y reintentar selectivamente.

## Fase 2: Motor de Probabilidades y Gestión de Riesgo (`src/analytics/`)

Módulos matemáticos puros (sin dependencias de base de datos, 100% testeables) que
transforman los datos ingeridos en la Fase 1 en predicciones y decisiones de apuesta:

| Módulo                  | Responsabilidad                                                                 |
|-------------------------|-----------------------------------------------------------------------------------|
| `xgEstimator.js`        | Estima el xG esperado de cada equipo a partir de sus últimos partidos (fuerza de ataque/defensa relativa a la media de la liga) |
| `poissonModel.js`       | Poisson Bivariada (Karlis & Ntzoufras): matriz de marcadores exactos y agregación a mercados (1X2, doble oportunidad, over/under, BTTS) |
| `valueBettingEngine.js` | Compara nuestra probabilidad vs la cuota del bookmaker; calcula el edge y filtra oportunidades > umbral (5% por defecto) |
| `parlayBuilder.js`      | Genera combinadas de bajo riesgo (Doble Oportunidad, Over 1.5, BTTS) con probabilidad acumulada proyectada > 85% |
| `kellyCriterion.js`     | Gestor de bankroll: Kelly fraccionado (25%/50%) con tope individual y control de exposición agregada simultánea |
| `predictMatch.js`       | Orquestador: conecta `analyticsRepository.js` (datos reales) con los módulos puros anteriores para un fixture concreto |

**Flujo típico** (ver `test/analytics/integration.test.js` para el pipeline completo):

```
últimos partidos (DB) → xgEstimator → poissonModel → valueBettingEngine (vs cuotas)
                                                              ↓
                                            parlayBuilder (combina legs de alta prob.)
                                                              ↓
                                              kellyCriterion (% de bankroll a apostar)
```

### Notas de diseño

- **Poisson Bivariada, no independiente**: el parámetro de covarianza (`lambda3`)
  modela la correlación entre los goles de ambos equipos, algo que dos Poisson
  independientes no capturan. Con `correlation=0` colapsa exactamente al caso independiente.
- **xG mezclado con goles reales**: `xgEstimator` pondera xG (más estable, menos ruido)
  con goles reales (lo que efectivamente decide el resultado) vía `xgWeight` (60% por defecto).
- **Edge = probabilidad × cuota − 1**: el valor esperado por unidad apostada si nuestra
  probabilidad es correcta. Solo se reportan cuotas con edge ≥ `minEdge` (5% por defecto).
- **Parlays de una leg por partido**: `parlayBuilder` nunca combina dos mercados del
  mismo partido (violaría el supuesto de independencia); se queda con la mejor leg por
  partido y luego combina entre partidos distintos, en orden descendente de probabilidad.
- **Kelly fraccionado con doble tope**: `kellyCriterion` aplica el multiplicador (25%/50%)
  sobre el Kelly completo, respeta un tope duro por apuesta (`maxStakeFraction`), y si hay
  varios paquetes simultáneos, escala proporcionalmente el stake total para no exceder
  `maxTotalExposureFraction` del bankroll.

### Pruebas

```bash
npm test
```

60 pruebas (`node --test`, sin dependencias externas) cubren: identidades matemáticas del
modelo de Poisson (colapso al caso independiente, preservación de medias marginales,
normalización de la matriz de marcadores), casos de borde del estimador de xG (sin
historial, sin datos de xG), el cálculo de edge y overround, el filtrado/deduplicación
de legs de parlay y el umbral de probabilidad acumulada, la fórmula de Kelly contra
valores de referencia conocidos, y un pipeline de integración end-to-end con datos sintéticos.

## Fase 3: API REST, Freemium y Stripe (`src/api/`)

### Levantar la API

```bash
npm run api       # producción
npm run dev:api   # con --watch
```

Escucha en `API_PORT` (4000 por defecto). Requiere las mismas migraciones de la Fase 1
más `006_users_and_billing.sql` y `007_performance_tracking.sql` (usuarios,
suscripciones, historial de recomendaciones para las métricas de rendimiento).

### Endpoints

| Endpoint                        | Acceso  | Descripción |
|----------------------------------|---------|-------------|
| `GET /api/predictions/today`      | Público (marcadores exactos ocultos sin VIP) | Predicciones (xG, 1X2, doble oportunidad, over/under, BTTS) de los fixtures próximos |
| `GET /api/packages/low-risk`       | Público | Paquetes combinados con probabilidad acumulada > 85%, con stake de Kelly |
| `GET /api/value-bets`               | **VIP** (`402` sin plan activo) | Cuotas con edge > 5%, ordenadas descendente, con stake de Kelly |
| `GET /api/stats/performance`         | Público | ROI%, % de aciertos y curva de bankroll históricos |
| `POST /api/auth/session`              | Público | Emite un JWT con el plan actual del email dado (ver nota de alcance abajo) |
| `POST /api/subscriptions/checkout`     | Público | Crea una sesión de Stripe Checkout (modo suscripción) para el plan VIP |
| `GET /api/subscriptions/me`             | Requiere JWT | Estado de la suscripción del usuario autenticado |
| `POST /api/webhooks/stripe`              | Stripe only (firma verificada) | Procesa `checkout.session.completed`, `customer.subscription.updated/deleted` |

Todos los query params se validan con Zod (`src/api/schemas.js`); una request inválida
devuelve `400` con el detalle de qué campo falló, nunca un 500 silencioso.

### Freemium

- **Gratis**: `predictions/today` (sin marcadores exactos), `packages/low-risk`,
  `stats/performance` — pensado para generar tracción mostrando el historial público
  y las combinadas más seguras.
- **VIP**: `value-bets` y los marcadores exactos (`topScores`) de `predictions/today`.
  Gateado por el middleware `requireVip` (`src/api/middleware/auth.js`), que exige un
  JWT Bearer con `plan: 'vip'`.

**Nota de alcance sobre auth**: `POST /api/auth/session` emite un JWT a partir de un
email SIN verificar su identidad (no hay password ni magic link) — ver el comentario
en `src/services/authService.js`. Es un scaffold suficiente para demostrar el flujo
freemium end-to-end; un producto real debe reemplazarlo por un proveedor de auth real.

### Stripe

`src/services/subscriptionService.js` implementa:
- `createCheckoutSession(email)` — crea la sesión de Checkout (`price` = `STRIPE_VIP_PRICE_ID`).
- `handleStripeEvent(event)` — procesa el webhook de forma **idempotente** (tabla
  `stripe_webhook_events`, un mismo `event.id` reenviado no se reprocesa) y transiciona
  el plan del usuario: `checkout.session.completed` → `vip`/`active`;
  `customer.subscription.updated` → sigue el `status` de Stripe (`past_due` degrada a
  `free`); `customer.subscription.deleted` → `free`/`canceled`.

Para probar localmente con la CLI de Stripe:
```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe
stripe trigger checkout.session.completed
```

### Pruebas de la Fase 3

`test/api/subscriptionService.test.js` inyecta repositorios en memoria (fakes) para
probar las transiciones de plan ante eventos de Stripe sin tocar la base de datos ni
la red — incluyendo el caso de idempotencia (evento reenviado). `test/api/authService.test.js`
prueba la verificación de JWT (firma inválida, expirado). `test/api/performanceStats.test.js`
cubre el cálculo de ROI/win rate/curva de bankroll. La app Express se probó manualmente
en este entorno (sin PostgreSQL disponible) contra `/health`, validación Zod, el 402 del
muro VIP sin token, y el 404 handler — ver el historial de la sesión que la generó.

## Frontend

El dashboard (Next.js + Tailwind + Recharts, dark mode, freemium) vive en el proyecto
hermano [`football-analytics-frontend`](../football-analytics-frontend). Requiere que
esta API esté corriendo (`npm run api`) y `CORS_ORIGIN` apuntando a su origen
(`http://localhost:3000` por defecto).

## Próximos pasos sugeridos

- Reemplazar el login por email (scaffold) por un proveedor de auth real (NextAuth, Clerk, Auth0).
- Job de agregación que calcule `team_season_stats` (promedios de xG, forma, etc.) a partir
  de `match_team_stats`.
- Job que registre automáticamente cada recomendación servida en `recommendation_records`
  y las liquide (won/lost) cuando el partido termine, para que `/api/stats/performance`
  refleje datos reales en vez de quedar vacío.
- Alertas (Slack/email) cuando un `ingestion_run` termine en `failed`.
- Backtesting histórico del motor de probabilidades contra resultados reales para calibrar
  `correlation`, `xgWeight` y el umbral de `minEdge`.
