import { getUptimeQueueDiagnostics } from '../../queues/uptime.queue.js';

export function makeWorkerHealthController(deps = {}) {
  const getDiagnostics = deps.getUptimeQueueDiagnostics ?? getUptimeQueueDiagnostics;

  return {
    async get(req, res) {
      const diagnostics = await getDiagnostics();
      const healthy = diagnostics.redis.ok === true;
      return res.status(healthy ? 200 : 503).json({
        success: healthy,
        message: healthy ? 'Worker diagnostics fetched' : 'Worker diagnostics unavailable',
        data: diagnostics,
      });
    },
  };
}

export const { get } = makeWorkerHealthController();
