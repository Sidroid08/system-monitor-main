import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma.js';

const DEMO_ORG = {
  name: 'Sidroid Demo',
  slug: 'sidroid-demo',
};

const DEMO_PASSWORD = 'DemoPass123!';

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function upsertUser({ organizationId, name, email, userRole, memberRole, passwordHash }) {
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      organizationId,
      name,
      passwordHash,
      role: userRole,
      isActive: true,
    },
    create: {
      organizationId,
      name,
      email,
      passwordHash,
      role: userRole,
      isActive: true,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId,
        userId: user.id,
      },
    },
    update: {
      role: memberRole,
      status: 'ACTIVE',
    },
    create: {
      organizationId,
      userId: user.id,
      role: memberRole,
      status: 'ACTIVE',
    },
  });

  return user;
}

async function resetDemoOperationalData(organizationId) {
  await prisma.incidentEvent.deleteMany({ where: { organizationId } });
  await prisma.incident.deleteMany({ where: { organizationId } });
  await prisma.alert.deleteMany({ where: { organizationId } });
  await prisma.uptimeAlertRule.deleteMany({ where: { organizationId } });
  await prisma.notificationChannel.deleteMany({ where: { organizationId } });
  await prisma.alertRule.deleteMany({ where: { organizationId } });
  await prisma.uptimeCheck.deleteMany({ where: { organizationId } });
  await prisma.logEntry.deleteMany({ where: { organizationId } });
  await prisma.metricSample.deleteMany({ where: { organizationId } });
  await prisma.auditLog.deleteMany({ where: { organizationId } });
  await prisma.monitoredService.deleteMany({ where: { organizationId } });
}

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: DEMO_ORG.slug },
    update: { name: DEMO_ORG.name },
    create: DEMO_ORG,
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const owner = await upsertUser({
    organizationId: org.id,
    name: 'Siddhant Owner',
    email: 'owner@sidroid.local',
    userRole: 'ADMIN',
    memberRole: 'OWNER',
    passwordHash,
  });
  const developer = await upsertUser({
    organizationId: org.id,
    name: 'Demo Developer',
    email: 'developer@sidroid.local',
    userRole: 'MEMBER',
    memberRole: 'DEVELOPER',
    passwordHash,
  });
  const viewer = await upsertUser({
    organizationId: org.id,
    name: 'Demo Viewer',
    email: 'viewer@sidroid.local',
    userRole: 'VIEWER',
    memberRole: 'VIEWER',
    passwordHash,
  });

  await resetDemoOperationalData(org.id);

  const checkoutApi = await prisma.monitoredService.create({
    data: {
      organizationId: org.id,
      name: 'Checkout API',
      slug: 'checkout-api',
      description: 'Demo customer checkout API used for uptime, logs, metrics, alerts, and incidents.',
      type: 'API',
      environment: 'production',
      url: 'https://example.com/checkout/health',
      healthPath: '/checkout/health',
      method: 'GET',
      expectedStatusCode: 200,
      timeoutMs: 4000,
      intervalSeconds: 60,
      currentStatus: 'DEGRADED',
      lastCheckedAt: minutesAgo(3),
      lastResponseTimeMs: 842,
      nextCheckAt: minutesAgo(-1),
      lastCheckSource: 'demo-seed',
      consecutiveFailures: 1,
      createdByUserId: owner.id,
      tags: { team: 'payments', tier: 'critical' },
    },
  });

  const statusPage = await prisma.monitoredService.create({
    data: {
      organizationId: org.id,
      name: 'Public Status Page',
      slug: 'status-page',
      description: 'Demo public status page dependency.',
      type: 'WEB',
      environment: 'production',
      url: 'https://example.com/status',
      healthPath: '/status',
      method: 'GET',
      expectedStatusCode: 200,
      timeoutMs: 3000,
      intervalSeconds: 120,
      currentStatus: 'UP',
      lastCheckedAt: minutesAgo(5),
      lastResponseTimeMs: 138,
      nextCheckAt: minutesAgo(-2),
      lastCheckSource: 'demo-seed',
      createdByUserId: owner.id,
      tags: { team: 'platform', tier: 'standard' },
    },
  });

  await prisma.uptimeCheck.createMany({
    data: [
      {
        organizationId: org.id,
        serviceId: checkoutApi.id,
        status: 'UP',
        httpStatusCode: 200,
        responseTimeMs: 156,
        checkedAt: minutesAgo(60),
        checkSource: 'demo-seed',
      },
      {
        organizationId: org.id,
        serviceId: checkoutApi.id,
        status: 'DEGRADED',
        httpStatusCode: 200,
        responseTimeMs: 842,
        checkedAt: minutesAgo(15),
        checkSource: 'demo-seed',
      },
      {
        organizationId: org.id,
        serviceId: checkoutApi.id,
        status: 'DOWN',
        httpStatusCode: 503,
        responseTimeMs: 0,
        errorMessage: 'Demo upstream payment provider timeout',
        checkedAt: minutesAgo(8),
        checkSource: 'demo-seed',
      },
      {
        organizationId: org.id,
        serviceId: statusPage.id,
        status: 'UP',
        httpStatusCode: 200,
        responseTimeMs: 138,
        checkedAt: minutesAgo(5),
        checkSource: 'demo-seed',
      },
    ],
  });

  await prisma.logEntry.createMany({
    data: [
      {
        organizationId: org.id,
        serviceId: checkoutApi.id,
        level: 'INFO',
        message: 'checkout request accepted',
        timestamp: minutesAgo(50),
        source: 'demo-api',
        environment: 'production',
        traceId: 'demo-trace-001',
        attributes: { route: '/checkout', statusCode: 202 },
        ingestionSource: 'SYSTEM',
      },
      {
        organizationId: org.id,
        serviceId: checkoutApi.id,
        level: 'WARN',
        message: 'payment provider latency above 750ms',
        timestamp: minutesAgo(18),
        source: 'demo-api',
        environment: 'production',
        traceId: 'demo-trace-002',
        attributes: { provider: 'demo-payments', latencyMs: 842 },
        ingestionSource: 'SYSTEM',
      },
      {
        organizationId: org.id,
        serviceId: checkoutApi.id,
        level: 'ERROR',
        message: 'checkout dependency timeout',
        timestamp: minutesAgo(8),
        source: 'demo-worker',
        environment: 'production',
        traceId: 'demo-trace-003',
        attributes: { provider: 'demo-payments', timeoutMs: 4000 },
        ingestionSource: 'SYSTEM',
      },
      {
        organizationId: org.id,
        serviceId: statusPage.id,
        level: 'INFO',
        message: 'status page rendered successfully',
        timestamp: minutesAgo(5),
        source: 'demo-web',
        environment: 'production',
        attributes: { route: '/status' },
        ingestionSource: 'SYSTEM',
      },
    ],
  });

  await prisma.metricSample.createMany({
    data: [
      {
        organizationId: org.id,
        serviceId: checkoutApi.id,
        name: 'checkout_latency_ms',
        type: 'GAUGE',
        value: 156,
        unit: 'ms',
        timestamp: minutesAgo(60),
        tags: { route: '/checkout' },
        ingestionSource: 'SYSTEM',
      },
      {
        organizationId: org.id,
        serviceId: checkoutApi.id,
        name: 'checkout_latency_ms',
        type: 'GAUGE',
        value: 842,
        unit: 'ms',
        timestamp: minutesAgo(15),
        tags: { route: '/checkout' },
        ingestionSource: 'SYSTEM',
      },
      {
        organizationId: org.id,
        serviceId: checkoutApi.id,
        name: 'checkout_errors_total',
        type: 'COUNTER',
        value: 3,
        unit: 'count',
        timestamp: minutesAgo(8),
        tags: { route: '/checkout' },
        ingestionSource: 'SYSTEM',
      },
      {
        organizationId: org.id,
        serviceId: statusPage.id,
        name: 'status_page_latency_ms',
        type: 'GAUGE',
        value: 138,
        unit: 'ms',
        timestamp: minutesAgo(5),
        tags: { route: '/status' },
        ingestionSource: 'SYSTEM',
      },
    ],
  });

  const channel = await prisma.notificationChannel.create({
    data: {
      organizationId: org.id,
      name: 'Demo Webhook',
      type: 'WEBHOOK',
      config: JSON.stringify({ url: 'http://localhost:9999/demo-webhook', method: 'POST' }),
      minSeverity: 'LOW',
      isActive: false,
    },
  });

  const uptimeRule = await prisma.uptimeAlertRule.create({
    data: {
      organizationId: org.id,
      serviceId: checkoutApi.id,
      name: 'Checkout API degraded or down',
      type: 'SERVICE_DEGRADED',
      severity: 'HIGH',
      isActive: true,
      cooldownSeconds: 300,
      notificationChannelId: channel.id,
      createdByUserId: owner.id,
      lastFiredAt: minutesAgo(8),
    },
  });

  const promRule = await prisma.alertRule.create({
    data: {
      organizationId: org.id,
      name: 'High checkout latency',
      description: 'Demo PromQL-style alert rule for interview walkthroughs.',
      promql: 'avg(checkout_latency_ms{service="checkout-api"})',
      condition: 'GT',
      threshold: 750,
      forCycles: 2,
      severity: 'HIGH',
      isActive: true,
      state: 'FIRING',
      pendingSince: minutesAgo(20),
      lastEvaluatedAt: minutesAgo(8),
      lastFiredAt: minutesAgo(8),
    },
  });

  const alert = await prisma.alert.create({
    data: {
      organizationId: org.id,
      ruleId: promRule.id,
      title: 'Checkout API latency above threshold',
      description: 'Demo alert generated from seeded metric samples.',
      severity: 'HIGH',
      source: 'demo-seed',
      metricName: 'checkout_latency_ms',
      status: 'OPEN',
      triggeredAt: minutesAgo(8),
      labels: JSON.stringify({
        serviceId: checkoutApi.id,
        serviceName: checkoutApi.name,
        uptimeRuleId: uptimeRule.id,
      }),
    },
  });

  const incident = await prisma.incident.create({
    data: {
      organizationId: org.id,
      serviceId: checkoutApi.id,
      alertId: alert.id,
      alertRuleId: uptimeRule.id,
      title: 'Checkout API degradation',
      description: 'Demo incident linked to seeded alert, uptime checks, logs, and metrics.',
      severity: 'HIGH',
      status: 'INVESTIGATING',
      source: 'ALERT',
      assignedToUserId: developer.id,
      createdByUserId: owner.id,
      acknowledgedByUserId: developer.id,
      acknowledgedAt: minutesAgo(7),
      startedAt: minutesAgo(8),
      impactSummary: 'Demo checkout requests are slower and some payment attempts time out.',
      metadata: { seeded: true, demo: 'phase-10' },
    },
  });

  await prisma.incidentEvent.createMany({
    data: [
      {
        organizationId: org.id,
        incidentId: incident.id,
        actorUserId: owner.id,
        type: 'CREATED',
        message: 'Demo incident created from high checkout latency alert.',
        createdAt: minutesAgo(8),
      },
      {
        organizationId: org.id,
        incidentId: incident.id,
        actorUserId: developer.id,
        type: 'ACKNOWLEDGED',
        message: 'Developer acknowledged the incident.',
        createdAt: minutesAgo(7),
      },
      {
        organizationId: org.id,
        incidentId: incident.id,
        actorUserId: developer.id,
        type: 'STATUS_CHANGED',
        message: 'Incident moved to INVESTIGATING.',
        metadata: { from: 'OPEN', to: 'INVESTIGATING' },
        createdAt: minutesAgo(6),
      },
    ],
  });

  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      actorUserId: owner.id,
      action: 'DEMO_SEED_COMPLETED',
      resourceType: 'DEMO_DATA',
      resourceId: org.id,
      metadata: {
        services: [checkoutApi.id, statusPage.id],
        incidentId: incident.id,
      },
    },
  });

  console.log('Demo seed completed.');
  console.log(JSON.stringify({
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
    },
    users: [
      { email: owner.email, role: 'OWNER' },
      { email: developer.email, role: 'DEVELOPER' },
      { email: viewer.email, role: 'VIEWER' },
    ],
    demoPassword: `${DEMO_PASSWORD} (local demo only)`,
    services: {
      checkoutApi: checkoutApi.id,
      statusPage: statusPage.id,
    },
    alert: alert.id,
    incident: incident.id,
    note: 'No API key was generated or printed. Create a disposable API key through POST /api/api-keys for ingestion demos.',
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('Demo seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
