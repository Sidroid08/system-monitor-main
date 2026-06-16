import {
  createAwsAccount,
  getAwsAccountsByOrganization,
} from './aws.repository.js';
import { createAwsAccountSchema } from './aws.schemas.js';
import { syncAwsAccountInstances } from './aws.sync.js';
import { requireOrganizationScope } from '../../utils/tenantScope.js';
import { writeAuditLog } from '../../lib/auditLogger.js';

export async function createAws(req, res) {
  const payload = createAwsAccountSchema.parse(req.body);
  const organizationId = requireOrganizationScope(req.user, payload.organizationId);
  const { organizationId: _ignoredOrganizationId, ...accountData } = payload;
  const awsAccount = await createAwsAccount({ ...accountData, organizationId });
  await writeAuditLog({
    req,
    organizationId,
    action: 'aws_account.created',
    resourceType: 'aws_account',
    resourceId: awsAccount.id,
    metadata: { accountName: awsAccount.accountName, authMode: awsAccount.authMode },
  });

  return res.status(201).json({
    success: true,
    data: awsAccount,
  });
}

export async function listAws(req, res) {
  const organizationId = requireOrganizationScope(req.user, req.query.organizationId);
  const awsAccounts = await getAwsAccountsByOrganization({ organizationId });

  return res.status(200).json({
    success: true,
    data: awsAccounts,
  });
}

export async function syncAws(req, res) {
  const { id } = req.params;
  const result = await syncAwsAccountInstances(id, { organizationId: req.user.organizationId });
  await writeAuditLog({
    req,
    organizationId: req.user.organizationId,
    action: 'aws_account.synced',
    resourceType: 'aws_account',
    resourceId: id,
    metadata: { discoveredCount: result.discoveredCount, syncLogId: result.syncLogId },
  });

  return res.status(200).json({
    success: true,
    message: 'AWS sync completed',
    data: result,
  });
}
