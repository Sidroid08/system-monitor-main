import { createApp } from './app.js';
import { env } from './config/env.js';
import prisma from './lib/prisma.js';
import { startEvaluator } from './lib/evaluator.js';

const app = createApp();

async function bootstrap() {
  await prisma.$connect();

  const server = app.listen(env.port, () => {
    console.log(`Sidroid backend running on port ${env.port} [${env.nodeEnv}]`);
  });

  if (env.nodeEnv !== 'test') {
    startEvaluator(env.evaluatorIntervalSeconds);
    console.log(`Alert evaluator started (every ${env.evaluatorIntervalSeconds}s)`);
  }

  async function shutdown(signal) {
    console.log(`Shutdown signal received: ${signal}`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch(async (error) => {
  console.error('Failed to start Sidroid backend', error);
  await prisma.$disconnect();
  process.exit(1);
});
