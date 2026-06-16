import crypto from 'crypto';
import { env } from '../../config/env.js';

export const API_KEY_SCOPES = Object.freeze([
  'metrics:write',
  'logs:write',
  'services:read',
  'alerts:read',
]);

const KEY_BYTES = 32;

export function generateRawApiKey() {
  const mode = env.isProduction ? 'live' : 'test';
  const secret = crypto.randomBytes(KEY_BYTES).toString('base64url');
  return `sm_${mode}_${secret}`;
}

export function apiKeyPrefix(rawKey) {
  return rawKey.split('_').slice(0, 3).join('_').slice(0, 24);
}

export function hashApiKey(rawKey) {
  return crypto
    .createHmac('sha256', env.apiKeyPepper)
    .update(rawKey)
    .digest('hex');
}

export function serializeScopes(scopes) {
  return JSON.stringify(scopes ?? []);
}

export function parseScopes(scopes) {
  if (Array.isArray(scopes)) return scopes;
  try {
    const parsed = JSON.parse(scopes || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function toApiKeyMetadata(apiKey) {
  return {
    id: apiKey.id,
    organizationId: apiKey.organizationId,
    name: apiKey.name,
    prefix: apiKey.prefix,
    scopes: parseScopes(apiKey.scopes),
    isActive: apiKey.isActive,
    expiresAt: apiKey.expiresAt,
    lastUsedAt: apiKey.lastUsedAt,
    revokedAt: apiKey.revokedAt,
    createdAt: apiKey.createdAt,
    updatedAt: apiKey.updatedAt,
  };
}
