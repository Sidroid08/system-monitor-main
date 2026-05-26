import prisma from '../../lib/prisma.js';

export async function createAwsAccount(data) {
  return prisma.awsAccount.create({
    data,
  });
}

export async function getAwsAccountsByOrganization({ organizationId } = {}) {
  return prisma.awsAccount.findMany({
    where: organizationId ? { organizationId } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
}

export async function findAwsAccountById(id) {
  return prisma.awsAccount.findUnique({
    where: { id },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
}

export async function updateAwsAccountSyncTimestamp(id) {
  return prisma.awsAccount.update({
    where: { id },
    data: {
      updatedAt: new Date(),
    },
  });
}

export async function insertSyncLog({ awsAccountId, status, message, discoveredCount = 0 }) {
  console.log('[AWS_SYNC_LOG]', {
    awsAccountId,
    status,
    message,
    discoveredCount,
    at: new Date().toISOString(),
  });

  return {
    awsAccountId,
    status,
    message,
    discoveredCount,
  };
}