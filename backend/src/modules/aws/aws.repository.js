import prisma from '../../lib/prisma.js';

function toSafeAwsAccount(account) {
  if (!account) return null;
  return {
    id: account.id,
    organizationId: account.organizationId,
    accountName: account.accountName,
    accountId: account.accountId,
    region: account.region,
    roleArn: account.roleArn,
    externalId: account.externalId ? '[configured]' : null,
    authMode: account.authMode,
    isActive: account.isActive,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    organization: account.organization
      ? { id: account.organization.id, name: account.organization.name, slug: account.organization.slug }
      : undefined,
  };
}

export async function createAwsAccount(data) {
  const account = await prisma.awsAccount.create({
    data,
    include: { organization: { select: { id: true, name: true, slug: true } } },
  });
  return toSafeAwsAccount(account);
}

export async function getAwsAccountsByOrganization({ organizationId, limit = 50, offset = 0 } = {}) {
  const where = organizationId ? { organizationId } : undefined;
  const include = { organization: { select: { id: true, name: true, slug: true } } };

  const [accounts, total] = await Promise.all([
    prisma.awsAccount.findMany({ where, orderBy: { createdAt: 'desc' }, include, take: limit, skip: offset }),
    prisma.awsAccount.count({ where }),
  ]);

  return { accounts: accounts.map(toSafeAwsAccount), total };
}

export async function findAwsAccountById(id) {
  return prisma.awsAccount.findUnique({
    where: { id },
    include: { organization: { select: { id: true, name: true, slug: true } } },
  });
}

export async function updateAwsAccountSyncTimestamp(id) {
  return prisma.awsAccount.update({ where: { id }, data: { updatedAt: new Date() } });
}

export async function createSyncLog({ organizationId, awsAccountId }) {
  return prisma.syncLog.create({
    data: { organizationId, awsAccountId, status: 'STARTED', startedAt: new Date() },
  });
}

export async function finishSyncLog(id, { status, errorMessage = null, resourcesDiscovered = 0 }) {
  return prisma.syncLog.update({
    where: { id },
    data: { status, errorMessage, resourcesDiscovered, finishedAt: new Date() },
  });
}
