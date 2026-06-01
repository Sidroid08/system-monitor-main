import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requiredStrongValue(name, minLength = 32) {
  const value = required(name).trim();
  const unsafeValues = ['change-me', 'changeme', 'replace-me'];

  if (value.length < minLength || unsafeValues.includes(value.toLowerCase())) {
    throw new Error(`${name} must be at least ${minLength} characters and cannot use a placeholder value.`);
  }

  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  jwtSecret: requiredStrongValue('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  databaseUrl: required('DATABASE_URL'),
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    name: process.env.DB_NAME ?? 'sidroid',
    user: process.env.DB_USER ?? 'root',
    password: required('DB_PASSWORD'),
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 10),
  },
  aws: {
    defaultRegion: process.env.AWS_DEFAULT_REGION ?? 'us-east-1',
    syncDefaultRegion: process.env.AWS_SYNC_DEFAULT_REGION ?? 'us-east-1',
  },
};
