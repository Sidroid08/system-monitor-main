import { listInstances } from './instances.repository.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * Returns instances formatted for VictoriaMetrics / Prometheus http_sd_configs.
 * Format:
 * [
 *   {
 *     "targets": ["<ip>:<port>"],
 *     "labels": {
 *       "instance": "<instanceId>",
 *       "organization_id": "<orgId>",
 *       "organization_name": "<orgName>",
 *       "node": "<instanceName>"
 *     }
 *   }
 * ]
 */
// Detect private/loopback IPs that Docker containers cannot reach directly.
// On Docker Desktop for Windows/Mac, containers live inside a Hyper-V VM and
// cannot reach the host via 192.168.x.x / 10.x.x.x etc.
// We remap the *scrape address* to host.docker.internal (Docker's magic DNS for
// the host machine) while keeping the original IP in the `instance` label so
// that all PromQL queries in the dashboard still match correctly.
function isPrivateIp(ip) {
  if (!ip) return false;
  return (
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip === 'localhost' ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

export const getSdTargets = asyncHandler(async (req, res) => {
  const instances = await listInstances();
  
  const targets = instances
    .filter(inst => inst.status === 'RUNNING' && (inst.privateIp || inst.publicIp))
    .map(inst => {
      const ip = inst.privateIp || inst.publicIp;
      // Default to 9100 for linux, 9182 for windows if not set
      const port = inst.exporterPort || (inst.platform === 'WINDOWS' ? 9182 : 9100);

      // Use host.docker.internal for private IPs so vmagent (running inside Docker)
      // can reach the host machine. The instance label stays as the real IP so
      // the dashboard PromQL queries (which filter by instance="<ip>:<port>") work.
      const scrapeHost = isPrivateIp(ip) ? 'host.docker.internal' : ip;
      
      return {
        targets: [`${scrapeHost}:${port}`],
        labels: {
          instance: `${ip}:${port}`,
          organization_id: inst.organizationId,
          organization_name: inst.organization?.name || 'Unknown',
          node: inst.instanceName || inst.instanceId,
          service: inst.platform.toLowerCase()
        }
      };
    });

  return res.status(200).json(targets);
});
