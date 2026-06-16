import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
process.env.API_KEY_PEPPER = 'test-api-key-pepper-at-least-32-chars';
process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/sidroid_test';
delete process.env.REDIS_URL;

const {
  enqueueDueUptimeChecks,
  findDueServices,
  isServiceDueForCheck,
} = await import('../src/queues/uptime.scheduler.js');
const {
  buildUptimeJobData,
  buildUptimeJobId,
  getUptimeQueueDiagnostics,
  UPTIME_JOB_NAME,
} = await import('../src/queues/uptime.queue.js');
const { requireRedisUrl } = await import('../src/queues/connection.js');
const { processUptimeCheckJob } = await import('../src/queues/uptime.worker.js');
const { makeWorkerHealthController } = await import('../src/modules/worker-health/workerHealth.controller.js');

function service(overrides = {}) {
  return {
    id: 'service-1',
    organizationId: 'org-a',
    type: 'HTTP',
    intervalSeconds: 60,
    isActive: true,
    deletedAt: null,
    lastCheckedAt: null,
    nextCheckAt: null,
    ...overrides,
  };
}

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('scheduler due logic respects active state, service type, nextCheckAt, and interval', () => {
  const now = new Date('2026-06-16T10:00:00.000Z');

  assert.equal(isServiceDueForCheck(service(), now), true);
  assert.equal(isServiceDueForCheck(service({ nextCheckAt: new Date('2026-06-16T09:59:59.000Z') }), now), true);
  assert.equal(isServiceDueForCheck(service({ nextCheckAt: new Date('2026-06-16T10:00:30.000Z') }), now), false);
  assert.equal(isServiceDueForCheck(service({ lastCheckedAt: new Date('2026-06-16T09:59:30.000Z') }), now), false);
  assert.equal(isServiceDueForCheck(service({ lastCheckedAt: new Date('2026-06-16T09:58:30.000Z') }), now), true);
  assert.equal(isServiceDueForCheck(service({ isActive: false }), now), false);
  assert.equal(isServiceDueForCheck(service({ deletedAt: new Date() }), now), false);
  assert.equal(isServiceDueForCheck(service({ type: 'CUSTOM' }), now), false);
});

test('findDueServices filters candidates returned by the database query', async () => {
  const now = new Date('2026-06-16T10:00:00.000Z');
  const prismaClient = {
    monitoredService: {
      findMany: async (query) => {
        assert.equal(query.take, 10);
        assert.deepEqual(query.where.type.in, ['HTTP', 'API', 'WEB']);
        return [
          service({ id: 'due' }),
          service({ id: 'future', nextCheckAt: new Date('2026-06-16T10:01:00.000Z') }),
          service({ id: 'inactive', isActive: false }),
        ];
      },
    },
  };

  const due = await findDueServices({ prismaClient, now, limit: 10 });
  assert.deepEqual(due.map((item) => item.id), ['due']);
});

test('enqueueDueUptimeChecks enqueues safe due-service jobs only', async () => {
  const now = new Date('2026-06-16T10:00:00.000Z');
  const jobs = [];
  const queue = {
    add: async (name, data, options) => {
      jobs.push({ name, data, options });
    },
  };
  const prismaClient = {
    monitoredService: {
      findMany: async () => [
        service({ id: 'service-1', url: 'https://example.com', lastCheckedAt: null }),
        service({ id: 'service-2', nextCheckAt: new Date('2026-06-16T10:01:00.000Z') }),
      ],
    },
  };

  const summary = await enqueueDueUptimeChecks({ queue, prismaClient, now, limit: 20 });

  assert.equal(summary.enqueued, 1);
  assert.equal(jobs[0].name, UPTIME_JOB_NAME);
  assert.deepEqual(jobs[0].data, {
    organizationId: 'org-a',
    serviceId: 'service-1',
    requestedBy: 'system',
    source: 'scheduler',
  });
  assert.equal(jobs[0].data.url, undefined);
  assert.equal(jobs[0].options.jobId, buildUptimeJobId(service({ id: 'service-1' }), now));
});

test('enqueueDueUptimeChecks counts duplicate job ids without failing the scheduler cycle', async () => {
  const queue = {
    add: async () => {
      throw new Error('Job id already exists');
    },
  };
  const prismaClient = {
    monitoredService: {
      findMany: async () => [service()],
    },
  };

  const summary = await enqueueDueUptimeChecks({ queue, prismaClient });

  assert.equal(summary.enqueued, 0);
  assert.equal(summary.duplicate, 1);
  assert.equal(summary.failed, 0);
});

test('worker loads service by organization and stores UP result', async () => {
  const calls = [];
  const result = await processUptimeCheckJob({
    data: {
      organizationId: 'org-a',
      serviceId: 'service-1',
      source: 'scheduler',
    },
  }, {
    repo: {
      findServiceById: async (serviceId, organizationId) => {
        calls.push(['find', serviceId, organizationId]);
        return service({ id: serviceId, organizationId, isActive: true });
      },
      createUptimeCheck: async (organizationId, serviceId, checkResult) => {
        calls.push(['check', serviceId, organizationId, checkResult.checkSource]);
        return { id: 'check-1', status: checkResult.status };
      },
    },
    checker: async (loadedService, options) => {
      assert.equal(loadedService.id, 'service-1');
      assert.equal(options.checkSource, 'scheduler');
      return {
        status: 'UP',
        httpStatusCode: 200,
        responseTimeMs: 42,
        errorMessage: null,
        checkSource: options.checkSource,
        metadata: {},
      };
    },
  });

  assert.equal(result.status, 'UP');
  assert.deepEqual(calls, [
    ['find', 'service-1', 'org-a'],
    ['check', 'service-1', 'org-a', 'scheduler'],
  ]);
});

test('worker skips inactive or missing services without running a check', async () => {
  let checkerCalled = false;
  const missing = await processUptimeCheckJob({
    data: { organizationId: 'org-a', serviceId: 'missing' },
  }, {
    repo: {
      findServiceById: async () => null,
      createUptimeCheck: async () => assert.fail('should not store missing service check'),
    },
    checker: async () => { checkerCalled = true; },
  });

  const inactive = await processUptimeCheckJob({
    data: { organizationId: 'org-a', serviceId: 'inactive' },
  }, {
    repo: {
      findServiceById: async () => service({ id: 'inactive', isActive: false }),
      createUptimeCheck: async () => assert.fail('should not store inactive service check'),
    },
    checker: async () => { checkerCalled = true; },
  });

  assert.equal(missing.skipped, true);
  assert.equal(inactive.reason, 'service_inactive');
  assert.equal(checkerCalled, false);
});

test('worker treats DOWN as a completed check result, not a failed job', async () => {
  const result = await processUptimeCheckJob({
    data: { organizationId: 'org-a', serviceId: 'service-1', source: 'scheduler' },
  }, {
    repo: {
      findServiceById: async () => service(),
      createUptimeCheck: async (organizationId, serviceId, checkResult) => ({
        id: 'check-down',
        status: checkResult.status,
      }),
    },
    checker: async () => ({
      status: 'DOWN',
      httpStatusCode: null,
      responseTimeMs: 5000,
      errorMessage: 'Request timed out',
      checkSource: 'scheduler',
      metadata: {},
    }),
  });

  assert.equal(result.skipped, false);
  assert.equal(result.status, 'DOWN');
});

test('worker propagates internal errors so BullMQ can retry the job', async () => {
  await assert.rejects(
    () => processUptimeCheckJob({
      data: { organizationId: 'org-a', serviceId: 'service-1', source: 'scheduler' },
    }, {
      repo: {
        findServiceById: async () => service(),
        createUptimeCheck: async () => {
          throw new Error('database unavailable');
        },
      },
      checker: async () => ({
        status: 'UP',
        httpStatusCode: 200,
        responseTimeMs: 12,
        errorMessage: null,
        checkSource: 'scheduler',
        metadata: {},
      }),
    }),
    /database unavailable/,
  );
});

test('missing REDIS_URL fails clearly for worker runtime helpers but not diagnostics', async () => {
  assert.throws(() => requireRedisUrl(), /REDIS_URL is required/);

  const diagnostics = await getUptimeQueueDiagnostics();
  assert.equal(diagnostics.redis.configured, false);
  assert.equal(diagnostics.queue.name, 'uptime-checks');
});

test('worker health controller reports queue diagnostics', async () => {
  const controller = makeWorkerHealthController({
    getUptimeQueueDiagnostics: async () => ({
      redis: { configured: true, ok: true, status: 'ready', error: null },
      queue: { name: 'uptime-checks', counts: { waiting: 0, active: 0 } },
      scheduler: { intervalSeconds: 15, scanLimit: 100, workerConcurrency: 5 },
    }),
  });

  const res = makeRes();
  await controller.get({}, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.queue.name, 'uptime-checks');
});

test('job data helper never includes service configuration or secrets', () => {
  const payload = buildUptimeJobData(service({ url: 'https://example.com', token: 'secret' }));

  assert.deepEqual(Object.keys(payload).sort(), ['organizationId', 'requestedBy', 'serviceId', 'source']);
  assert.equal(payload.url, undefined);
  assert.equal(payload.token, undefined);
});
