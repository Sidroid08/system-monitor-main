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
export const getSdTargets = asyncHandler(async (req, res) => {
  const instances = await listInstances();
  
  const targets = instances
    .filter(inst => inst.status === 'RUNNING' && (inst.privateIp || inst.publicIp))
    .map(inst => {
      const ip = inst.privateIp || inst.publicIp;
      // Default to 9100 for linux, 9182 for windows if not set
      const port = inst.exporterPort || (inst.platform === 'WINDOWS' ? 9182 : 9100);
      
      return {
        targets: [`${ip}:${port}`],
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
