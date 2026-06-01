import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import prisma from './lib/prisma.js';
import { vmHealthCheck } from './lib/vmClient.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import orgRoutes from './modules/organizations/org.routes.js';
import awsRoutes from './modules/aws/aws.routes.js';
import instanceRoutes from './modules/instances/instances.routes.js';
import alertRuleRoutes from './modules/alert-rules/alertRules.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';
import queryRoutes from './modules/query/query.routes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin === '*' ? true : env.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));
  if (env.nodeEnv !== 'test') {
    app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  }

  // Liveness — fast, no I/O.
  app.get('/health', (req, res) => {
    res.json({ success: true, status: 'ok', service: 'sidroid-backend' });
  });

  // Readiness — checks DB and VictoriaMetrics.
  app.get('/health/ready', async (req, res) => {
    const checks = await Promise.allSettled([
      prisma.$queryRaw`SELECT 1`,
      vmHealthCheck(),
    ]);

    const db = checks[0].status === 'fulfilled';
    const vm = checks[1].status === 'fulfilled' && checks[1].value === true;
    const ready = db && vm;

    res.status(ready ? 200 : 503).json({
      success: ready,
      status: ready ? 'ready' : 'not ready',
      checks: { db: db ? 'ok' : 'unreachable', vm: vm ? 'ok' : 'unreachable' },
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/org', orgRoutes);
  app.use('/api/aws', awsRoutes);
  app.use('/api/instances', instanceRoutes);
  app.use('/api/alert-rules', alertRuleRoutes);
  app.use('/api/notification-channels', notificationRoutes);
  app.use('/api/query', queryRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
