const express = require('express');
const cors = require('cors');
const config = require('../config');
const { attachUser } = require('./middleware/auth');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const webhooksRouter = require('./routes/webhooks');
const predictionsRouter = require('./routes/predictions');
const packagesRouter = require('./routes/packages');
const valueBetsRouter = require('./routes/valueBets');
const statsRouter = require('./routes/stats');
const authRouter = require('./routes/auth');
const subscriptionsRouter = require('./routes/subscriptions');
const adminRouter = require('./routes/admin');
const bankrollRouter = require('./routes/bankroll');
const leaguesRouter = require('./routes/leagues');

function createApp() {
  const app = express();

  app.use(cors({ origin: config.api.corsOrigin }));
  app.disable('x-powered-by');

  // El webhook de Stripe necesita el body RAW (sin parsear) para verificar la
  // firma HMAC -> se monta antes de express.json(), que solo aplica al resto.
  app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhooksRouter);

  app.use(express.json());
  app.use(attachUser);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/predictions', predictionsRouter);
  app.use('/api/packages', packagesRouter);
  app.use('/api/value-bets', valueBetsRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/subscriptions', subscriptionsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/bankroll', bankrollRouter);
  app.use('/api/leagues', leaguesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
