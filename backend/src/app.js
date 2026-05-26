import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import orgRoutes from './modules/organizations/org.routes.js';
import awsRoutes from './modules/aws/aws.routes.js';
import instanceRoutes from './modules/instances/instances.routes.js';
import alertRoutes from './modules/alerts/alerts.routes.js';
import alertRulesRoutes from './modules/alert-rules/alert-rules.routes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin === '*' ? true : env.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

  app.get('/health', (req, res) => {
    res.json({ success: true, message: 'Sidroid backend healthy' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/org', orgRoutes);
  app.use('/api/aws', awsRoutes);
  app.use('/api/instances', instanceRoutes);
  app.use('/api/alerts', alertRoutes);
  app.use('/api/alert-rules', alertRulesRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
