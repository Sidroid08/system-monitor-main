import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

function required(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function boolEnv(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function numberEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

// In production, refuse a weak JWT secret.
const jwtSecret = required('JWT_SECRET', isProduction ? undefined : 'change-me');
if (isProduction && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}
const apiKeyPepper = required('API_KEY_PEPPER', isProduction ? undefined : jwtSecret);
if (isProduction && apiKeyPepper.length < 32) {
  throw new Error('API_KEY_PEPPER must be at least 32 characters in production');
}
const corsOrigin = isProduction ? required('CORS_ORIGIN') : (process.env.CORS_ORIGIN || '*');

// Resolve the path for file_sd target files relative to the project root.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultTargetsDir = path.resolve(__dirname, '../../../../configs/targets');

export const env = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT ?? 5000),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? (isProduction ? '15m' : '7d'),
  apiKeyPepper,
  corsOrigin,

  databaseUrl: required('DATABASE_URL'),
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    name: process.env.DB_NAME ?? 'sidroid',
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 10),
  },

  aws: {
    defaultRegion: process.env.AWS_DEFAULT_REGION ?? 'us-east-1',
    syncDefaultRegion: process.env.AWS_SYNC_DEFAULT_REGION ?? 'us-east-1',
  },

  // Internal VictoriaMetrics URL — accessible within the Docker network.
  victoriaMetricsUrl: process.env.VICTORIA_METRICS_URL ?? 'http://victoriametrics:8428',

  // Alert evaluation: how often to run the evaluator (seconds).
  evaluatorIntervalSeconds: Number(process.env.EVALUATOR_INTERVAL_SECONDS ?? 30),

  // Redis is required by queue workers/schedulers, but not by the API server.
  redis: {
    url: process.env.REDIS_URL ?? '',
  },

  rateLimit: {
    enabled: boolEnv('RATE_LIMIT_ENABLED', nodeEnv !== 'test'),
    store: process.env.RATE_LIMIT_STORE ?? 'memory',
    auth: {
      windowSeconds: numberEnv('AUTH_RATE_LIMIT_WINDOW_SECONDS', 60),
      max: numberEnv('AUTH_RATE_LIMIT_MAX', 10),
    },
    ingest: {
      windowSeconds: numberEnv('INGEST_RATE_LIMIT_WINDOW_SECONDS', 60),
      max: numberEnv('INGEST_RATE_LIMIT_MAX', 120),
    },
    query: {
      windowSeconds: numberEnv('QUERY_RATE_LIMIT_WINDOW_SECONDS', 60),
      max: numberEnv('QUERY_RATE_LIMIT_MAX', 300),
    },
  },

  uptime: {
    schedulerIntervalSeconds: Number(process.env.UPTIME_SCHEDULER_INTERVAL_SECONDS ?? 15),
    schedulerScanLimit: Number(process.env.UPTIME_SCHEDULER_SCAN_LIMIT ?? 100),
    workerConcurrency: Number(process.env.UPTIME_WORKER_CONCURRENCY ?? 5),
  },

  // File-based service discovery target directory written after each AWS sync.
  targetsDirPath: process.env.TARGETS_DIR_PATH ?? defaultTargetsDir,

  // Telemetry ingestion retention.
  telemetry: {
    logRetentionDays: Number(process.env.LOG_RETENTION_DAYS ?? 30),
    metricRetentionDays: Number(process.env.METRIC_RETENTION_DAYS ?? 30),
    retentionBatchSize: Number(process.env.TELEMETRY_RETENTION_BATCH_SIZE ?? 1000),
    maxAcceptedLogsPerRequest: numberEnv('TELEMETRY_MAX_ACCEPTED_LOGS_PER_REQUEST', 100),
    maxAcceptedMetricsPerRequest: numberEnv('TELEMETRY_MAX_ACCEPTED_METRICS_PER_REQUEST', 100),
  },

  // SMTP for email notifications (optional — notifications fall back to Slack/webhook if absent).
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'Sidroid Alerts <alerts@sidroid.io>',
  },
};
