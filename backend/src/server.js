import { createApp } from './app.js';
import { env } from './config/env.js';
import prisma from './lib/prisma.js';

const app = createApp();

async function bootstrap() {
  await prisma.$connect();

  app.listen(env.port, () => {
    console.log(`Sidroid backend running on port ${env.port}`);
  });
}

bootstrap().catch(async (error) => {
  console.error('Failed to start Sidroid backend', error);
  await prisma.$disconnect();
  process.exit(1);
});