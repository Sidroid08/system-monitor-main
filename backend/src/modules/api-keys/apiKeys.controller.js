import { ok } from '../../utils/apiResponse.js';
import { notFound } from '../../utils/errors.js';
import { writeAuditLog } from '../../lib/auditLogger.js';
import { createApiKeySchema } from './apiKeys.schemas.js';
import {
  apiKeyPrefix,
  generateRawApiKey,
  hashApiKey,
} from './apiKeys.service.js';
import {
  createApiKeyRecord,
  listApiKeyRecords,
  revokeApiKeyRecord,
} from './apiKeys.repository.js';

export function makeApiKeysController(deps = {}) {
  const repo = {
    createApiKeyRecord,
    listApiKeyRecords,
    revokeApiKeyRecord,
    ...(deps.repo ?? {}),
  };
  const keyService = {
    generateRawApiKey,
    apiKeyPrefix,
    hashApiKey,
    ...(deps.keyService ?? {}),
  };
  const audit = deps.writeAuditLog ?? writeAuditLog;

  return {
    async create(req, res) {
      const payload = createApiKeySchema.parse(req.body);
      const rawKey = keyService.generateRawApiKey();
      const apiKey = await repo.createApiKeyRecord({
        organizationId: req.user.organizationId,
        createdByUserId: req.user.id,
        name: payload.name,
        prefix: keyService.apiKeyPrefix(rawKey),
        keyHash: keyService.hashApiKey(rawKey),
        scopes: payload.scopes,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
      });

      await audit({
        req,
        organizationId: req.user.organizationId,
        action: 'api_key.created',
        resourceType: 'api_key',
        resourceId: apiKey.id,
        metadata: { name: apiKey.name, scopes: apiKey.scopes },
      });

      return ok(res, { apiKey, key: rawKey }, 'API key created', 201);
    },

    async list(req, res) {
      const apiKeys = await repo.listApiKeyRecords(req.user.organizationId);
      return ok(res, { apiKeys }, 'API keys fetched');
    },

    async revoke(req, res) {
      const count = await repo.revokeApiKeyRecord(req.params.id, req.user.organizationId);
      if (count === 0) throw notFound('API key not found');

      await audit({
        req,
        organizationId: req.user.organizationId,
        action: 'api_key.revoked',
        resourceType: 'api_key',
        resourceId: req.params.id,
      });

      return ok(res, null, 'API key revoked');
    },
  };
}

export const { create, list, revoke } = makeApiKeysController();
