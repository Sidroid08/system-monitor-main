import { hashApiKey, parseScopes } from '../modules/api-keys/apiKeys.service.js';
import { findActiveApiKeyByHash, markApiKeyUsed } from '../modules/api-keys/apiKeys.repository.js';

export function requireApiKeyScope(scope) {
  return function requireApiKeyScopeMiddleware(req, res, next) {
    if (!req.apiKey?.scopes?.includes(scope)) {
      return res.status(403).json({ success: false, message: 'API key scope denied' });
    }
    return next();
  };
}

export async function authenticateApiKey(req, res, next) {
  const rawKey = req.get('x-api-key');
  if (!rawKey) {
    return res.status(401).json({ success: false, message: 'Missing API key' });
  }

  const apiKey = await findActiveApiKeyByHash(hashApiKey(rawKey));
  if (!apiKey) {
    return res.status(401).json({ success: false, message: 'Invalid API key' });
  }

  req.apiKey = {
    id: apiKey.id,
    organizationId: apiKey.organizationId,
    scopes: parseScopes(apiKey.scopes),
  };

  markApiKeyUsed(apiKey.id).catch(() => {});
  return next();
}
