import prisma from '../../lib/prisma.js';
import { serializeScopes, toApiKeyMetadata } from './apiKeys.service.js';

export async function createApiKeyRecord({
  organizationId,
  createdByUserId,
  name,
  prefix,
  keyHash,
  scopes,
  expiresAt = null,
}) {
  const apiKey = await prisma.apiKey.create({
    data: {
      organizationId,
      createdByUserId,
      name,
      prefix,
      keyHash,
      scopes: serializeScopes(scopes),
      expiresAt,
    },
  });

  return toApiKeyMetadata(apiKey);
}

export async function listApiKeyRecords(organizationId) {
  const apiKeys = await prisma.apiKey.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });

  return apiKeys.map(toApiKeyMetadata);
}

export async function revokeApiKeyRecord(id, organizationId) {
  const result = await prisma.apiKey.updateMany({
    where: { id, organizationId, revokedAt: null },
    data: { isActive: false, revokedAt: new Date() },
  });

  return result.count;
}

export async function findActiveApiKeyByHash(keyHash) {
  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!apiKey || !apiKey.isActive || apiKey.revokedAt) return null;
  if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) return null;
  return apiKey;
}

export async function markApiKeyUsed(id) {
  return prisma.apiKey.update({
    where: { id },
    data: { lastUsedAt: new Date() },
  });
}
