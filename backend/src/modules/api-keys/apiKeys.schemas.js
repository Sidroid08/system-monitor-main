import { z } from 'zod';
import { API_KEY_SCOPES } from './apiKeys.service.js';

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(120),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1).default(['metrics:write']),
  expiresAt: z.string().datetime().optional(),
});
