import { createApp } from './app.js';
import { env } from './config/env.js';
import prisma from './lib/prisma.js';
import { startAlertEvaluator } from './workers/alertEvaluator.js';
import { provisionAllInstanceDashboards } from './modules/instances/dashboard.service.js';

const app = createApp();

async function bootstrap() {
  await prisma.$connect();

  app.listen(env.port, () => {
    console.log(`Sidroid backend running on port ${env.port}`);
    startAlertEvaluator();

    // Backfill dedicated Grafana dashboards for all existing instances.
    // Runs async so it never blocks server startup. Grafana may not be ready
    // immediately, so we add a small delay.
    setTimeout(async () => {
      try {
        const instances = await prisma.monitoredInstance.findMany({
          select: { id: true, instanceId: true, instanceName: true, privateIp: true, publicIp: true, organizationId: true, platform: true },
        });
        if (instances.length > 0) {
          await provisionAllInstanceDashboards(instances);
        }
      } catch (err) {
        console.warn('[Startup] Dashboard backfill failed (non-fatal):', err.message);
      }
    }, 8000); // Wait 8s for Grafana to be fully ready
  });
}

bootstrap().catch(async (error) => {
  console.error('Failed to start Sidroid backend', error);
  await prisma.$disconnect();
  process.exit(1);
});