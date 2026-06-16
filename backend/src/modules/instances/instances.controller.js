import { ok } from '../../utils/apiResponse.js';
import { requireOrganizationScope } from '../../utils/tenantScope.js';
import { listInstances } from './instances.repository.js';

export async function getInstances(req, res) {
  const organizationId = requireOrganizationScope(req.user, req.query.orgId);
  const instances = await listInstances({ organizationId });
  return ok(res, { instances }, 'Instances fetched');
}
