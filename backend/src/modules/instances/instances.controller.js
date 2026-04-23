import { ok } from '../../utils/apiResponse.js';
import { listInstances } from './instances.repository.js';

export async function getInstances(req, res) {
  const organizationId = req.query.orgId ? Number(req.query.orgId) : null;
  const instances = await listInstances({ organizationId });
  return ok(res, { instances }, 'Instances fetched');
}
